import { DurableObject } from "cloudflare:workers";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, type HarnessInspection, type TaskId } from "@earendil-works/pi-durable";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import type { Env } from "../platform-env";
import type { ChatMessage, Schedule } from "../protocol/chat";
import { SessionCredentialStore } from "./credentials";
import { createStarterHarnessOptions } from "./harness";
import { RoomPromptContext } from "./room-context";
import { scheduleFromTask, DeliverScheduledInstruction } from "./schedule-task";

type PiSessionStatus = {
  readonly ok: true;
  readonly rootConversationId: number;
  readonly liveTasks: number;
  readonly queuedSubmissions: number;
};

export class PiSession extends DurableObject<Env> {
  readonly #credentials = new SessionCredentialStore();
  readonly #ready: Promise<Harness>;

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

  async setRoomContext(input: { workspaceId: string; workspaceTitle: string; actorId: string; text: string }): Promise<void> {
    const harness = await this.#ready;
    await harness.commit(async (tx) => {
      const doc = await tx.doc(RoomPromptContext);
      doc.workspaceId = input.workspaceId;
      doc.workspaceTitle = input.workspaceTitle;
      doc.actorId = input.actorId;
      doc.text = input.text;
    }, BACKGROUND_CONTEXT);
  }

  async runAgent(input: {
    actorId: string;
    actorName: string;
    workspaceId: string;
    workspaceTitle: string;
    promptContext: string;
    requestId: string;
    userMessage: string;
    provider: "workers-ai" | "anthropic";
    model: string;
    apiKey?: string;
  }): Promise<ChatMessage> {
    await this.setRoomContext({ workspaceId: input.workspaceId, workspaceTitle: input.workspaceTitle, actorId: input.actorId, text: input.promptContext });
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
    const harness = await this.#ready;
    const roomContext = await harness.snapshot(RoomPromptContext, BACKGROUND_CONTEXT);
    await this.setRoomContext({ workspaceId: input.workspaceId, workspaceTitle: input.workspaceTitle ?? roomContext?.workspaceTitle ?? "Room", actorId: input.actorId, text: roomContext?.text ?? "" });
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
    const harness = await Harness.open(storage, createStarterHarnessOptions(this.env, this.#credentials, scheduleOperations), BACKGROUND_CONTEXT);
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

  async #roomContext(): Promise<{ workspaceId: string; workspaceTitle: string; actorId: string }> {
    const snapshot = await (await this.#ready).snapshot(RoomPromptContext, BACKGROUND_CONTEXT);
    return { workspaceId: snapshot?.workspaceId ?? "", workspaceTitle: snapshot?.workspaceTitle ?? "Room", actorId: snapshot?.actorId ?? "" };
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
