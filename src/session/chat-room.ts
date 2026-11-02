import { DurableObject } from "cloudflare:workers";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, type Conversation, type HarnessInspection, type Submission, type TaskId } from "@earendil-works/pi-durable";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import type { Models } from "@earendil-works/pi-ai";
import type { Env } from "../platform-env";
import type { ChatMessage, McpToolSummary, RoomSnapshot, Schedule } from "../protocol/chat";
import { callMcpTool, listMcpTools } from "../integrations/mcp";
import { DEFAULT_WORKERS_AI_MODEL } from "../agent/models";
import { messageNeedsFollowUp } from "./follow-up-classifier";
import { DeliverProactiveFollowUp, FollowUpCursor, type ProactiveFollowUpInput } from "./follow-up-task";
import { createStarterHarnessOptions } from "./harness";
import { RoomPromptContext } from "./room-context";
import { DeliverScheduledInstruction, type PiScheduledInstruction } from "./schedule-task";
import { snapshotFromView, messagesFromEntries, promptContext } from "./transcript";

const encoder = new TextEncoder();
const ROOT_CONVERSATION_ID = 1 as const;
const FOLLOW_UP_DELAY_MS = 30 * 60 * 1000;
const MCP_CACHE_MS = 60_000;

type FollowUpInput = Partial<ProactiveFollowUpInput>;
type McpStatus = { configured: boolean; tools: McpToolSummary[]; error?: string };

/** One named room owns the group transcript and its Pi Durable conversation. */
export class ChatRoom extends DurableObject<Env> {
  readonly #ready: Promise<Harness>;
  #models: Models | undefined;
  #mcpCache: { url: string; expiresAt: number; tools: McpToolSummary[] } | undefined;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#ready = ctx.blockConcurrencyWhile(() => this.#openHarness());
  }

  async getMessages(): Promise<ChatMessage[]> {
    const root = await (await this.#ready).root(BACKGROUND_CONTEXT);
    return messagesFromEntries((await root.context(BACKGROUND_CONTEXT)).entries);
  }

  /** Stream an initial room snapshot and every committed Pi Durable conversation update as SSE frames. */
  async watch(): Promise<ReadableStream<Uint8Array>> {
    const harness = await this.#ready;
    const root = await harness.root(BACKGROUND_CONTEXT);
    const watch = await root.watch(BACKGROUND_CONTEXT);
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    return new ReadableStream<Uint8Array>({
      type: "bytes",
      start: (controller) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshotFromView(watch.value))}\n\n`));
          watch.start(async (view) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshotFromView(view))}\n\n`));
            } catch {
              await watch.stop();
            }
          });
          heartbeat = setInterval(() => {
            try { controller.enqueue(encoder.encode(": keepalive\n\n")); }
            catch { if (heartbeat) clearInterval(heartbeat); }
          }, 15_000);
          void watch.closed.then(() => {
            if (heartbeat) clearInterval(heartbeat);
            try { controller.close(); } catch { /* The browser already cancelled the stream. */ }
          });
        } catch (error) {
          if (heartbeat) clearInterval(heartbeat);
          controller.error(error);
          void watch.stop();
        }
      },
      cancel: () => {
        if (heartbeat) clearInterval(heartbeat);
        return watch.stop().then(() => undefined);
      },
    });
  }

  async sendGroupMessage(input: { authorName: string; text: string }): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      authorName: input.authorName.trim() || "Guest",
      kind: "group",
      text: input.text.trim(),
      createdAt: Date.now(),
    };
    await this.#serialize(async () => {
      const harness = await this.#ready;
      const root = await harness.root(BACKGROUND_CONTEXT);
      const submission = await root.submit({
        type: "write",
        entry: { kind: "chat.message", data: message },
      }, BACKGROUND_CONTEXT);
      await submission.wait(BACKGROUND_CONTEXT);
      await this.#updatePromptContext(root);
    });
    this.ctx.waitUntil(this.#monitorMessage(message).catch((error) => this.#log("Follow-up monitor failed", error)));
    return message;
  }

  async askAgent(input: { authorName: string; text: string; requestId: string }): Promise<{ requestId: string }> {
    const authorName = input.authorName.trim() || "Guest";
    const text = input.text.trim();
    const requestId = input.requestId || crypto.randomUUID();
    await this.#serialize(async () => {
      const harness = await this.#ready;
      const root = await harness.root(BACKGROUND_CONTEXT);
      const ask: ChatMessage = { id: requestId, authorName, kind: "agent-request", text, createdAt: Date.now() };
      await this.#updatePromptContext(root, ask);
      harness.resume();
      const submission = await root.submit({
        type: "input",
        content: `${authorName}: ${text}`,
        entry: { kind: "chat.ask", data: ask },
        requestId,
        whenBusy: "followUp",
      }, BACKGROUND_CONTEXT);
      this.ctx.waitUntil(this.#finishSubmission(submission));
    });
    return { requestId };
  }

  async mcpStatus(): Promise<McpStatus> {
    const url = this.env.MCP_URL?.trim();
    if (!url) return { configured: false, tools: [] };
    try {
      return { configured: true, tools: await this.#getMcpTools(true) };
    } catch (error) {
      return { configured: true, tools: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  async alarm(): Promise<void> {
    const harness = await this.#ready;
    harness.resume();
    await harness.waitForIdle(BACKGROUND_CONTEXT);
    await this.#refreshWakeupAlarm(harness);
  }

  async #openHarness(): Promise<Harness> {
    const schedules = {
      list: () => this.#listSchedules(),
      cancel: (id: string) => this.#cancelSchedule(id),
    };
    const capabilities = {
      listMcpTools: () => this.#getMcpTools(),
      callMcpTool: async (input: { toolName: string; args: Record<string, unknown> }) => {
        const url = this.env.MCP_URL?.trim();
        if (!url) throw new Error("No MCP_URL is configured on the Worker.");
        if (!(await this.#getMcpTools()).some((tool) => tool.name === input.toolName)) throw new Error("That tool is not advertised by the configured MCP server.");
        return callMcpTool(url, input.toolName, input.args);
      },
    };
    const options = createStarterHarnessOptions(this.env, schedules, capabilities);
    this.#models = options.models;
    const storage = await openDurableObjectSqliteStorage(this.ctx.storage);
    const harness = await Harness.open(storage, options, BACKGROUND_CONTEXT);
    harness.resume();
    await this.#refreshWakeupAlarm(harness);
    return harness;
  }

  async #updatePromptContext(root: Conversation, extra?: ChatMessage): Promise<void> {
    const messages = messagesFromEntries((await root.context(BACKGROUND_CONTEXT)).entries);
    if (extra) messages.push(extra);
    let tools: McpToolSummary[] = [];
    try { tools = await this.#getMcpTools(); }
    catch (error) { this.#log("MCP tool discovery failed; continuing without MCP", error); }
    const contextText = promptContext(messages, tools);
    await (await this.#ready).commit(async (tx) => {
      const doc = await tx.doc(RoomPromptContext);
      doc.text = contextText;
    }, BACKGROUND_CONTEXT);
  }

  async #monitorMessage(message: ChatMessage): Promise<void> {
    const harness = await this.#ready;
    const root = await harness.root(BACKGROUND_CONTEXT);
    const revision = await harness.commit(async (tx) => {
      const cursor = await tx.doc(FollowUpCursor);
      cursor.revision += 1;
      return cursor.revision;
    }, BACKGROUND_CONTEXT);

    const inspection = await harness.inspect(BACKGROUND_CONTEXT);
    for (const task of inspection.tasks) {
      if (task.record.kind !== DeliverProactiveFollowUp.definition.name) continue;
      const input = task.record.input as FollowUpInput;
      if (typeof input.triggerRevision === "number" && input.triggerRevision < revision) {
        await harness.abortTask(task.record.id, BACKGROUND_CONTEXT);
      }
    }

    if (!this.#models) return;
    const messages = messagesFromEntries((await root.context(BACKGROUND_CONTEXT)).entries);
    const recent = messages.slice(-30).map((item) => `${item.authorName}: ${item.text}`).join("\n").slice(-7000);
    let needsFollowUp = false;
    try {
      needsFollowUp = await messageNeedsFollowUp(this.#models, this.env.AI_MODEL?.trim() || DEFAULT_WORKERS_AI_MODEL, message, recent);
    } catch (error) {
      this.#log("Follow-up classification failed", error);
      return;
    }
    if (!needsFollowUp) return;

    const dueAt = Date.now() + FOLLOW_UP_DELAY_MS;
    await root.commit(async (tx) => {
      const cursor = await tx.doc(FollowUpCursor);
      if (cursor.revision !== revision) return;
      await tx.createTask(DeliverProactiveFollowUp, {
        conversationId: root.id,
        triggerRevision: revision,
        authorName: message.authorName,
        message: message.text.slice(0, 2000),
        recentConversation: recent,
        dueAt,
      }, { ownership: { kind: "conversation" }, background: true });
    }, BACKGROUND_CONTEXT);
    await this.#refreshWakeupAlarm(harness);
  }

  async #listSchedules(): Promise<Schedule[]> {
    const inspection = await (await this.#ready).inspect(BACKGROUND_CONTEXT);
    return inspection.tasks.flatMap((task) => {
      if (task.record.kind !== DeliverScheduledInstruction.definition.name || task.state.kind === "blocked") return [];
      const input = task.record.input as Partial<PiScheduledInstruction>;
      if (typeof input.instruction !== "string" || typeof input.runAt !== "number") return [];
      return [{ id: String(task.record.id), instruction: input.instruction, runAt: input.runAt }];
    }).sort((a, b) => a.runAt - b.runAt);
  }

  async #cancelSchedule(id: string): Promise<boolean> {
    const taskId = Number(id);
    if (!Number.isSafeInteger(taskId)) return false;
    const harness = await this.#ready;
    const task = await harness.getTask(taskId as TaskId, BACKGROUND_CONTEXT);
    if (!task || task.kind !== DeliverScheduledInstruction.definition.name) return false;
    const cancelled = await harness.abortTask(taskId as TaskId, BACKGROUND_CONTEXT);
    await this.#refreshWakeupAlarm(harness);
    return cancelled === "marked";
  }

  async #getMcpTools(refresh = false): Promise<McpToolSummary[]> {
    const url = this.env.MCP_URL?.trim();
    if (!url) return [];
    if (!refresh && this.#mcpCache?.url === url && this.#mcpCache.expiresAt > Date.now()) return this.#mcpCache.tools;
    const tools = (await listMcpTools(url)).map((tool) => ({
      name: tool.name,
      ...(tool.title === undefined ? {} : { title: tool.title }),
      ...(tool.description === undefined ? {} : { description: tool.description }),
    }));
    this.#mcpCache = { url, expiresAt: Date.now() + MCP_CACHE_MS, tools };
    return tools;
  }

  async #finishSubmission(submission: Submission): Promise<void> {
    try {
      const settled = await submission.wait(BACKGROUND_CONTEXT);
      if (settled.status !== "done") this.#log("Agent submission ended without a final answer", settled.status);
    } catch (error) {
      this.#log("Agent submission failed", error);
    } finally {
      try { await this.#refreshWakeupAlarm(); }
      catch (error) { this.#log("Could not refresh the room alarm", error); }
    }
  }

  async #refreshWakeupAlarm(harness?: Harness): Promise<void> {
    const inspection: HarnessInspection = await (harness ?? await this.#ready).inspect(BACKGROUND_CONTEXT);
    const now = Date.now();
    const deadlines = inspection.tasks.flatMap((task) => {
      if (task.record.kind === DeliverScheduledInstruction.definition.name) {
        const runAt = (task.record.input as Partial<PiScheduledInstruction>).runAt;
        return typeof runAt === "number" ? [runAt > now ? runAt : now + 60_000] : [];
      }
      if (task.record.kind === DeliverProactiveFollowUp.definition.name) {
        const input = task.record.input as FollowUpInput;
        const checkpoint = "checkpoint" in task.record.state ? task.record.state.checkpoint as { phase?: string; retryAt?: number } : undefined;
        const retryAt = checkpoint?.phase === "retry" ? checkpoint.retryAt : input.dueAt;
        return typeof retryAt === "number" && Number.isFinite(retryAt) ? [retryAt > now ? retryAt : now + 60_000] : [];
      }
      return [];
    });
    if (deadlines.length === 0) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.min(...deadlines));
  }

  async #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#writeQueue;
    let release!: () => void;
    this.#writeQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  #log(message: string, error: unknown): void {
    console.error(JSON.stringify({ message, error: error instanceof Error ? error.message : String(error) }));
  }
}
