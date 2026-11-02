import { DurableObject } from "cloudflare:workers";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, type HarnessInspection, type TaskId } from "@earendil-works/pi-durable";
import type { AssistantMessage, Models } from "@earendil-works/pi-ai";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import type { Env } from "../platform-env";
import type { ChatMessage, Schedule } from "../protocol/chat";
import { messageNeedsFollowUp } from "./follow-up-classifier";
import type { MultiPersonChatRpc } from "../chat-rpc";
import { SessionCredentialStore } from "./credentials";
import { DeliverProactiveFollowUp, FollowUpCursor, type ProactiveFollowUpInput } from "./follow-up-task";
import { defaultAiModel } from "../agent/models";
import { createStarterHarnessOptions } from "./harness";
import { RoomPromptContext } from "./room-context";
import { scheduleFromTask, DeliverScheduledInstruction } from "./schedule-task";

type AgentTurnInput = {
  actorId: string;
  actorName: string;
  publicOrigin: string;
  workspaceId: string;
  workspaceTitle: string;
  promptContext: string;
  requestId: string;
  userMessage: string;
  provider: "workers-ai" | "anthropic";
  model: string;
  apiKey?: string;
};

type ObserveMessageInput = { message: ChatMessage; recentConversation: string; workspaceTitle: string };

type PiSessionStatus = {
  readonly ok: true;
  readonly rootConversationId: number;
  readonly liveTasks: number;
  readonly queuedSubmissions: number;
};

export class PiSession extends DurableObject<Env> {
  readonly #credentials = new SessionCredentialStore();
  readonly #ready: Promise<Harness>;
  #models: Models | undefined;
  #contextQueue: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#ready = ctx.blockConcurrencyWhile(() => this.#openHarness());
  }

  async status(): Promise<PiSessionStatus> {
    const harness = await this.#ready;
    await this.#hydrateAnthropicCredential();
    harness.resume();
    const root = await harness.root(BACKGROUND_CONTEXT);
    const inspection: HarnessInspection = await harness.inspect(BACKGROUND_CONTEXT);
    return {
      ok: true,
      rootConversationId: root.id,
      liveTasks: inspection.tasks.length,
      queuedSubmissions: inspection.submissions.length,
    };
  }

  async setRoomContext(input: { workspaceId: string; workspaceTitle: string; actorId: string; publicOrigin: string; text: string }): Promise<void> {
    const harness = await this.#ready;
    await harness.commit(async (tx) => {
      const doc = await tx.doc(RoomPromptContext);
      doc.workspaceId = input.workspaceId;
      doc.workspaceTitle = input.workspaceTitle;
      doc.actorId = input.actorId;
      doc.publicOrigin = input.publicOrigin;
      doc.text = input.text;
    }, BACKGROUND_CONTEXT);
  }

  async observeGroupMessage(input: ObserveMessageInput): Promise<void> {
    return this.#withContextQueue(() => this.#observeGroupMessage(input));
  }

  async #observeGroupMessage(input: ObserveMessageInput): Promise<void> {
    const message = input.message;
    const harness = await this.#ready;
    const room = await harness.snapshot(RoomPromptContext, BACKGROUND_CONTEXT);
    await this.setRoomContext({
      workspaceId: message.workspaceId,
      workspaceTitle: input.workspaceTitle,
      actorId: message.authorId,
      publicOrigin: room?.publicOrigin ?? "",
      text: room?.text ?? "",
    });
    await this.#hydrateAnthropicCredential(message.authorId);

    const revision = await harness.commit(async (tx) => {
      const cursor = await tx.doc(FollowUpCursor);
      cursor.revision += 1;
      return cursor.revision;
    }, BACKGROUND_CONTEXT);
    const inspection = await harness.inspect(BACKGROUND_CONTEXT);
    for (const task of inspection.tasks) {
      if (task.record.kind !== DeliverProactiveFollowUp.definition.name) continue;
      const scheduled = task.record.input as Partial<ProactiveFollowUpInput>;
      if (scheduled.workspaceId === message.workspaceId && typeof scheduled.triggerRevision === "number" && scheduled.triggerRevision < revision) {
        await harness.abortTask(task.record.id, BACKGROUND_CONTEXT);
      }
    }

    let needsFollowUp = false;
    if (message.kind === "group") {
      try {
        const appState = this.env.CHAT.getByName("default-group") as unknown as {
          getAiRuntimeSettings(memberId: string): Promise<{ provider: "workers-ai" | "anthropic"; model: string } | null>;
        };
        const settings = await appState.getAiRuntimeSettings(message.authorId);
        const provider = settings?.provider === "anthropic" ? "anthropic" : "cloudflare";
        await this.#hydrateAnthropicCredential(message.authorId);
        if (this.#models) needsFollowUp = await messageNeedsFollowUp(this.#models, provider, settings?.model ?? defaultAiModel(this.env), message, input.recentConversation);
      } catch (error) {
        console.warn(JSON.stringify({ message: "Pi AI follow-up classification failed", error: error instanceof Error ? error.message : String(error) }));
      }
    }
    if (needsFollowUp) {
      const root = await harness.root(BACKGROUND_CONTEXT);
      const dueAt = Date.now() + 30 * 60 * 1000;
      await root.commit((tx) => tx.createTask(DeliverProactiveFollowUp, {
        workspaceId: message.workspaceId,
        conversationId: root.id,
        triggerRevision: revision,
        authorId: message.authorId,
        authorName: message.authorName,
        message: message.text.slice(0, 4000),
        recentConversation: input.recentConversation.slice(-7000),
        dueAt,
      }, { ownership: { kind: "conversation" }, background: true }), BACKGROUND_CONTEXT);
      await this.#setAlarmNoLaterThan(dueAt);
    }
    harness.resume();
    await this.#refreshWakeupAlarm(harness);
  }

  async scheduleLegacyFollowUp(input: { legacyId: string; actorId: string; authorName: string; workspaceId: string; message: string; recentConversation: string }): Promise<void> {
    return this.#withContextQueue(() => this.#scheduleLegacyFollowUp(input));
  }

  async #scheduleLegacyFollowUp(input: { legacyId: string; actorId: string; authorName: string; workspaceId: string; message: string; recentConversation: string }): Promise<void> {
    const harness = await this.#ready;
    const room = await harness.snapshot(RoomPromptContext, BACKGROUND_CONTEXT);
    await this.setRoomContext({ workspaceId: input.workspaceId, workspaceTitle: room?.workspaceTitle ?? "Room", actorId: input.actorId, publicOrigin: room?.publicOrigin ?? "", text: room?.text ?? "" });
    await this.#hydrateAnthropicCredential(input.actorId);
    const root = await harness.root(BACKGROUND_CONTEXT);
    const cursor = await harness.snapshot(FollowUpCursor, BACKGROUND_CONTEXT);
    const dueAt = Date.now();
    await root.commit((tx) => tx.createTask(DeliverProactiveFollowUp, {
      workspaceId: input.workspaceId,
      conversationId: root.id,
      triggerRevision: cursor?.revision ?? 0,
      authorId: input.actorId,
      authorName: input.authorName,
      message: input.message.slice(0, 4000),
      recentConversation: input.recentConversation.slice(-7000),
      dueAt,
      requestKey: input.legacyId,
    }, { ownership: { kind: "conversation" }, background: true }), BACKGROUND_CONTEXT);
    harness.resume();
    await this.#refreshWakeupAlarm(harness);
  }

  async runAgent(input: AgentTurnInput): Promise<ChatMessage> {
    return this.#withContextQueue(() => this.#runAgentTurn(input));
  }

  async #runAgentTurn(input: AgentTurnInput): Promise<ChatMessage> {
    await this.setRoomContext({ workspaceId: input.workspaceId, workspaceTitle: input.workspaceTitle, actorId: input.actorId, publicOrigin: input.publicOrigin, text: input.promptContext });
    await this.#credentials.setAnthropicKey(input.provider === "anthropic" ? input.apiKey : undefined);

    const harness = await this.#ready;
    const root = await harness.root(BACKGROUND_CONTEXT);
    await root.configure({
      model: { provider: input.provider === "anthropic" ? "anthropic" : "cloudflare", modelId: input.model },
      thinkingLevel: "off",
    }, BACKGROUND_CONTEXT);
    harness.resume();
    const submission = await root.submit({
      type: "input",
      content: `${input.actorName}: ${input.userMessage}`,
      requestId: input.requestId,
      whenBusy: "followUp",
    }, BACKGROUND_CONTEXT);
    await submission.wait(BACKGROUND_CONTEXT);
    await this.#refreshWakeupAlarm();

    const view = await root.context(BACKGROUND_CONTEXT);
    const last = view.entries
      .filter((entry) => entry.kind === "pi.assistant")
      .map((entry) => ({ entry, assistant: entry.model?.find((message): message is AssistantMessage => message.role === "assistant") }))
      .filter((item): item is { entry: (typeof view.entries)[number]; assistant: AssistantMessage } => item.assistant !== undefined)
      .filter(({ assistant }) => assistant.stopReason !== "toolUse" && assistant.stopReason !== "pending")
      .at(-1);
    if (last === undefined) throw new Error("Pi Durable completed the request without a final assistant message");
    const text = last.assistant.content.flatMap((part) => part.type === "text" && part.text.trim() ? [part.text.trim()] : []).join("\n").trim();
    if (!text) throw new Error(last.assistant.errorMessage || "Pi Durable returned an empty assistant response");
    return {
      id: -last.entry.id,
      workspaceId: input.workspaceId,
      authorId: "agent",
      authorName: "Group Agent",
      kind: "agent",
      text,
      createdAt: last.assistant.timestamp,
    };
  }

  async listAgentMessages(input: { workspaceId: string }): Promise<ChatMessage[]> {
    const harness = await this.#ready;
    await this.#hydrateAnthropicCredential();
    harness.resume();
    const root = await harness.root(BACKGROUND_CONTEXT);
    const view = await root.context(BACKGROUND_CONTEXT);
    return view.entries.flatMap<ChatMessage>((entry): ChatMessage[] => {
      if (entry.kind === "pi.user") {
        const user = entry.model?.find((message) => message.role === "user");
        if (!user) return [];
        const content = typeof user.content === "string"
          ? user.content
          : user.content.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n");
        const prefix = "Scheduled reminder: ";
        if (!content.startsWith(prefix)) return [];
        return [{
          id: -entry.id,
          workspaceId: input.workspaceId,
          authorId: "agent",
          authorName: "Scheduled reminder",
          kind: "system" as const,
          text: content.slice(prefix.length),
          createdAt: user.timestamp,
        }];
      }
      if (entry.kind !== "pi.assistant") return [];
      const assistant = entry.model?.find((message): message is AssistantMessage => message.role === "assistant");
      if (!assistant || assistant.stopReason === "toolUse" || assistant.stopReason === "pending") return [];
      const text = assistant.content.flatMap((part) => part.type === "text" && part.text.trim() ? [part.text.trim()] : []).join("\n").trim();
      if (!text) return [];
      return [{
        id: -entry.id,
        workspaceId: input.workspaceId,
        authorId: "agent",
        authorName: "Group Agent",
        kind: "agent" as const,
        text,
        createdAt: assistant.timestamp,
      }];
    });
  }

  async listSchedules(input: { workspaceId: string; workspaceTitle?: string; from?: number; to?: number }): Promise<Schedule[]> {
    const from = Number.isFinite(input.from) ? input.from as number : 0;
    const to = Number.isFinite(input.to) ? input.to as number : Number.MAX_SAFE_INTEGER;
    const inspection = await (await this.#ready).inspect(BACKGROUND_CONTEXT);
    return inspection.tasks
      .map(scheduleFromTask)
      .filter((schedule): schedule is Schedule => schedule !== null)
      .filter((schedule) => schedule.workspaceId === input.workspaceId && schedule.runAt >= from && schedule.runAt <= to)
      .map((schedule) => ({ ...schedule, workspaceTitle: schedule.workspaceTitle ?? input.workspaceTitle }))
      .sort((left, right) => left.runAt - right.runAt);
  }

  async createSchedule(input: { actorId: string; workspaceId: string; workspaceTitle?: string; instruction: string; runAt: number }): Promise<Schedule> {
    return this.#withContextQueue(() => this.#createSchedule(input));
  }

  async #createSchedule(input: { actorId: string; workspaceId: string; workspaceTitle?: string; instruction: string; runAt: number }): Promise<Schedule> {
    const harness = await this.#ready;
    const roomContext = await harness.snapshot(RoomPromptContext, BACKGROUND_CONTEXT);
    await this.setRoomContext({ workspaceId: input.workspaceId, workspaceTitle: input.workspaceTitle ?? roomContext?.workspaceTitle ?? "Room", actorId: input.actorId, publicOrigin: roomContext?.publicOrigin ?? "", text: roomContext?.text ?? "" });
    await this.#hydrateAnthropicCredential(input.actorId);
    const root = await harness.root(BACKGROUND_CONTEXT);
    const createdAt = Date.now();
    const instruction = input.instruction.trim();
    if (!instruction || instruction.length > 1000) throw new Error("Schedule instruction must contain 1–1000 characters");
    if (!Number.isSafeInteger(input.runAt) || input.runAt <= createdAt || input.runAt > createdAt + 366 * 24 * 60 * 60 * 1000) throw new Error("Schedule time must be within the next year");
    const taskId = await root.commit((tx) => tx.createTask(DeliverScheduledInstruction, {
      workspaceId: input.workspaceId,
      ...(input.workspaceTitle === undefined ? {} : { workspaceTitle: input.workspaceTitle }),
      conversationId: root.id,
      instruction,
      runAt: input.runAt,
      createdBy: input.actorId,
      createdAt,
    }, { ownership: { kind: "conversation" }, background: true }), BACKGROUND_CONTEXT);
    harness.resume();
    await this.#setAlarmNoLaterThan(input.runAt);
    return { id: String(taskId), workspaceId: input.workspaceId, workspaceTitle: input.workspaceTitle, instruction, runAt: input.runAt, createdBy: input.actorId, createdAt };
  }

  async deleteSchedule(input: { scheduleId: string; workspaceId?: string }): Promise<boolean> {
    const scheduleId = Number(input.scheduleId);
    if (!Number.isSafeInteger(scheduleId)) return false;
    const harness = await this.#ready;
    const task = await harness.getTask(scheduleId as TaskId, BACKGROUND_CONTEXT);
    if (!task || task.kind !== DeliverScheduledInstruction.definition.name) return false;
    const payload = task.input as Partial<{ workspaceId: string }>;
    if (input.workspaceId !== undefined && payload.workspaceId !== input.workspaceId) return false;
    const result = await harness.abortTask(scheduleId as TaskId, BACKGROUND_CONTEXT);
    await this.#refreshWakeupAlarm();
    return result === "marked";
  }

  async alarm(): Promise<void> {
    const harness = await this.#ready;
    await this.#hydrateAnthropicCredential();
    harness.resume();
    await harness.waitForIdle(BACKGROUND_CONTEXT);
    await this.#refreshWakeupAlarm();
  }

  async #openHarness(): Promise<Harness> {
    const storage = await openDurableObjectSqliteStorage(this.ctx.storage);
    const scheduleOperations = {
      list: async () => {
        const room = await this.#roomContext();
        return this.listSchedules({ workspaceId: room.workspaceId, workspaceTitle: room.workspaceTitle, from: Date.now() });
      },
      cancel: async (scheduleId: string) => {
        const room = await this.#roomContext();
        return this.deleteSchedule({ scheduleId, workspaceId: room.workspaceId });
      },
    };
    const capabilityOperations = {
      callConnector: async (input: { connectorId: string; toolName: string; args: Record<string, unknown> }) => {
        const room = await this.#roomContext();
        if (!room.actorId || !room.publicOrigin) throw new Error("The room actor context is not ready");
        const chat = this.env.CHAT.getByName("default-group") as unknown as MultiPersonChatRpc;
        const connector = (await chat.listConnectors(room.actorId)).find((item) => item.id === input.connectorId);
        if (!connector || connector.status !== "connected" || !connector.tools.some((tool) => tool.name === input.toolName)) {
          throw new Error("Connector or tool is not currently available in this room");
        }
        return chat.callConnectorTool({ actorId: room.actorId, connectorId: input.connectorId, publicOrigin: room.publicOrigin, toolName: input.toolName, args: input.args });
      },
      readSkillFile: async (input: { slug: string; path?: string }) => {
        const room = await this.#roomContext();
        if (!room.actorId) throw new Error("The room actor context is not ready");
        const chat = this.env.CHAT.getByName("default-group") as unknown as MultiPersonChatRpc;
        const skill = (await chat.listSkills(room.actorId)).find((item) => item.enabled && item.slug === input.slug);
        if (!skill) throw new Error("Enabled skill not found");
        const path = input.path ?? "SKILL.md";
        const file = (await chat.listSkillFiles({ actorId: room.actorId, skillId: skill.id })).find((item) => item.path === path);
        if (!file) throw new Error("Skill file not found");
        return { path, content: file.content };
      },
    };
    const options = createStarterHarnessOptions(this.env, this.#credentials, scheduleOperations, capabilityOperations);
    this.#models = options.models;
    const harness = await Harness.open(storage, options, BACKGROUND_CONTEXT);
    await this.#refreshWakeupAlarm(harness);
    return harness;
  }

  async #refreshWakeupAlarm(harness?: Harness): Promise<void> {
    const inspection = await (harness ?? await this.#ready).inspect(BACKGROUND_CONTEXT);
    const now = Date.now();
    const deadlines = inspection.tasks
      .map(scheduleFromTask)
      .filter((schedule): schedule is Schedule => schedule !== null)
      .map((schedule) => schedule.runAt > now ? schedule.runAt : now + 60_000);
    deadlines.push(...inspection.tasks
      .filter((task) => task.record.kind === DeliverProactiveFollowUp.definition.name)
      .map((task) => {
        const checkpoint = "checkpoint" in task.record.state ? task.record.state.checkpoint as { phase?: string; retryAt?: number } : undefined;
        const retryAt = checkpoint?.phase === "retry" ? checkpoint.retryAt : undefined;
        return typeof retryAt === "number" ? retryAt : (task.record.input as Partial<ProactiveFollowUpInput>).dueAt;
      })
      .filter((dueAt): dueAt is number => typeof dueAt === "number" && Number.isFinite(dueAt))
      .map((dueAt) => dueAt > now ? dueAt : now + 60_000));
    if (deadlines.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(...deadlines));
  }

  async #setAlarmNoLaterThan(timestamp: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > timestamp) await this.ctx.storage.setAlarm(timestamp);
  }

  async #roomContext(): Promise<{ workspaceId: string; workspaceTitle: string; actorId: string; publicOrigin: string }> {
    const snapshot = await (await this.#ready).snapshot(RoomPromptContext, BACKGROUND_CONTEXT);
    return { workspaceId: snapshot?.workspaceId ?? "", workspaceTitle: snapshot?.workspaceTitle ?? "Room", actorId: snapshot?.actorId ?? "", publicOrigin: snapshot?.publicOrigin ?? "" };
  }

  async #withContextQueue<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#contextQueue;
    let release!: () => void;
    this.#contextQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async #hydrateAnthropicCredential(actorId?: string): Promise<void> {
    const room = await this.#roomContext();
    let credentialOwner = actorId || room.actorId;
    if (!credentialOwner) {
      const inspection = await (await this.#ready).inspect(BACKGROUND_CONTEXT);
      credentialOwner = inspection.tasks
        .map(scheduleFromTask)
        .find((schedule) => schedule !== null && schedule.createdBy !== "agent")?.createdBy ?? "";
    }
    if (!credentialOwner || credentialOwner === "agent") return;
    const appState = this.env.CHAT.getByName("default-group") as unknown as {
      getAiRuntimeSettings(memberId: string): Promise<{ provider: "workers-ai" | "anthropic"; apiKey?: string } | null>;
    };
    const settings = await appState.getAiRuntimeSettings(credentialOwner);
    await this.#credentials.setAnthropicKey(settings?.provider === "anthropic" ? settings.apiKey : undefined);
  }
}
