import { DurableObject } from "cloudflare:workers";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, type Conversation, type ConversationWatch, type HarnessInspection, type Submission, type TaskId } from "@earendil-works/pi-durable";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import type { Models } from "@earendil-works/pi-ai";
import type { Env } from "../platform-env";
import type { ChatMessage, McpServerConfig, McpServerStatus, McpToolSummary, RoomSnapshot, Schedule, WorkspaceInfo } from "../protocol/chat";
import { callMcpTool, listMcpTools } from "../integrations/mcp";
import { DEFAULT_WORKERS_AI_MODEL } from "../agent/models";
import { messageNeedsFollowUp } from "./follow-up-classifier";
import { DeliverProactiveFollowUp, FollowUpCursor, type ProactiveFollowUpInput } from "./follow-up-task";
import { createStarterHarnessOptions } from "./harness";
import { RoomPromptContext } from "./room-context";
import { WorkspaceInfoDocument } from "./workspace-info";
import { DeliverScheduledInstruction, type PiScheduledInstruction } from "./schedule-task";
import { snapshotFromView, messagesFromEntries, promptContext } from "./transcript";

const ROOT_CONVERSATION_ID = 1 as const;
const FOLLOW_UP_DELAY_MS = 15 * 60 * 1000;
const MCP_CACHE_MS = 60_000;
const DELETED_WORKSPACE_KEY = "workspace-deleted";

type FollowUpInput = Partial<ProactiveFollowUpInput>;
type McpStatus = { configured: boolean; servers: McpServerStatus[]; tools: McpToolSummary[] };
type McpCache = { fingerprint: string; expiresAt: number; servers: McpServerStatus[] };

/** One named room owns the group transcript and its Pi Durable conversation. */
export class ChatRoom extends DurableObject<Env> {
  readonly #ready: Promise<Harness | undefined>;
  #models: Models | undefined;
  #mcpCache: McpCache | undefined;
  #writeQueue: Promise<void> = Promise.resolve();
  #broadcastWatch: ConversationWatch | undefined;
  #watchStarting: Promise<ConversationWatch> | undefined;
  #workspaceInfo: WorkspaceInfo | null | undefined;
  #deleted = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#ready = ctx.blockConcurrencyWhile(async () => {
      if (await ctx.storage.get<boolean>(DELETED_WORKSPACE_KEY)) {
        this.#deleted = true;
        return undefined;
      }
      return this.#openHarness();
    });
    if (this.#hasOpenWebSockets()) {
      this.ctx.waitUntil(this.#ready.then(async (harness) => {
        if (harness) await this.#ensureBroadcastWatch();
      }).catch((error) => this.#log("Could not restore the room WebSocket watch", error)));
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade.", { status: 426, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (this.#deleted || await this.ctx.storage.get<boolean>(DELETED_WORKSPACE_KEY)) {
      return Response.json({ error: "Workspace has been deleted." }, { status: 404 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    try {
      const hadWatch = this.#broadcastWatch !== undefined;
      const watch = await this.#ensureBroadcastWatch();
      if (hadWatch) this.#sendSocket(server, { type: "snapshot", snapshot: snapshotFromView(watch.value, this.#workspaceInfo) });
      return new Response(null, { status: 101, webSocket: client });
    } catch (error) {
      try { server.close(1011, "Workspace connection failed"); } catch { /* The connection may already be closed. */ }
      throw error;
    }
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string" || message.length > 10_000) {
      this.#sendSocket(socket, { type: "error", error: "Send a chat message as a small JSON text frame." });
      return;
    }
    let command: unknown;
    try { command = JSON.parse(message); }
    catch {
      this.#sendSocket(socket, { type: "error", error: "Send a valid JSON message." });
      return;
    }
    if (!command || typeof command !== "object" || Array.isArray(command)) {
      this.#sendSocket(socket, { type: "error", error: "Send a JSON object." });
      return;
    }
    const input = command as Record<string, unknown>;
    if (input.type === "snapshot") {
      try {
        const watch = await this.#ensureBroadcastWatch();
        this.#sendSocket(socket, { type: "snapshot", snapshot: snapshotFromView(watch.value, this.#workspaceInfo) });
      } catch (error) {
        this.#sendSocket(socket, { type: "error", error: error instanceof Error ? error.message : "Could not load the workspace." });
      }
      return;
    }
    if (input.type !== "send" || (input.target !== "group" && input.target !== "agent")) {
      this.#sendSocket(socket, { type: "error", error: "Unknown chat action." });
      return;
    }
    const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
    const authorName = typeof input.authorName === "string" ? input.authorName.trim() : "";
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (!requestId || requestId.length > 120) {
      this.#sendSocket(socket, { type: "error", error: "requestId is required and must be 120 characters or fewer." });
      return;
    }
    if (!authorName || authorName.length > 80) {
      this.#sendSocket(socket, { type: "error", requestId, error: "Display name is required and must be 80 characters or fewer." });
      return;
    }
    if (!text || text.length > 4000) {
      this.#sendSocket(socket, { type: "error", requestId, error: "Message is required and must be 4000 characters or fewer." });
      return;
    }
    try {
      await this.#ensureBroadcastWatch();
      await this.#assertActive();
      if (input.target === "group") await this.sendGroupMessage({ authorName, text, requestId });
      else await this.askAgent({ authorName, text, requestId });
      this.#sendSocket(socket, { type: "ack", requestId, status: "accepted" });
    } catch (error) {
      this.#sendSocket(socket, { type: "error", requestId, error: error instanceof Error ? error.message : "The message could not be sent." });
    }
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    try { socket.close(code, reason); } catch { /* The connection is already closed. */ }
    if (!this.#hasOpenWebSockets()) await this.#stopBroadcastWatch();
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    try { socket.close(1011, "WebSocket error"); } catch { /* The connection is already closed. */ }
    if (!this.#hasOpenWebSockets()) await this.#stopBroadcastWatch();
  }

  async getMessages(): Promise<ChatMessage[]> {
    const root = await (await this.#activeHarness()).root(BACKGROUND_CONTEXT);
    return messagesFromEntries((await root.context(BACKGROUND_CONTEXT)).entries);
  }

  async initializeWorkspace(workspace: WorkspaceInfo): Promise<WorkspaceInfo> {
    await this.#assertActive();
    return this.#serialize(async () => {
      const harness = await this.#activeHarness();
      return harness.commit(async (tx) => {
        const info = await tx.doc(WorkspaceInfoDocument);
        if (!info.id) {
          info.id = workspace.id;
          info.title = workspace.title;
          info.createdAt = workspace.createdAt;
        }
        return { id: info.id, title: info.title, createdAt: info.createdAt };
      }, BACKGROUND_CONTEXT);
    });
  }

  async getWorkspace(): Promise<WorkspaceInfo | null> {
    const state = await (await this.#activeHarness()).commit(async (tx) => {
      const info = await tx.doc(WorkspaceInfoDocument);
      return { id: info.id, title: info.title, createdAt: info.createdAt };
    }, BACKGROUND_CONTEXT);
    return state.id ? state : null;
  }

  async sendGroupMessage(input: { authorName: string; text: string; requestId: string }): Promise<ChatMessage> {
    await this.#assertActive();
    const message: ChatMessage = {
      id: input.requestId,
      authorName: input.authorName.trim() || "Guest",
      kind: "group",
      text: input.text.trim(),
      createdAt: Date.now(),
    };
    const result = await this.#serialize(async () => {
      const harness = await this.#activeHarness();
      const root = await harness.root(BACKGROUND_CONTEXT);
      const existingEntry = (await root.context(BACKGROUND_CONTEXT)).entries.find((entry) => {
        if (entry.kind !== "chat.message" || !entry.data || typeof entry.data !== "object" || Array.isArray(entry.data)) return false;
        return entry.data.id === message.id;
      });
      if (existingEntry) {
        const existing = messagesFromEntries([existingEntry]).find((item) => item.kind === "group");
        if (existing) return { message: existing, created: false };
      }
      const submission = await root.submit({
        type: "write",
        requestId: `group:${message.id}`,
        entry: { kind: "chat.message", data: message },
      }, BACKGROUND_CONTEXT);
      await submission.wait(BACKGROUND_CONTEXT);
      await this.#updatePromptContext(root);
      return { message, created: true };
    });
    if (result.created) this.ctx.waitUntil(this.#monitorMessage(result.message).catch((error) => this.#log("Follow-up monitor failed", error)));
    return result.message;
  }

  async askAgent(input: { authorName: string; text: string; requestId: string }): Promise<{ requestId: string }> {
    await this.#assertActive();
    const authorName = input.authorName.trim() || "Guest";
    const text = input.text.trim();
    const requestId = input.requestId || crypto.randomUUID();
    await this.#serialize(async () => {
      const harness = await this.#activeHarness();
      const root = await harness.root(BACKGROUND_CONTEXT);
      const existingAsk = (await root.context(BACKGROUND_CONTEXT)).entries.some((entry) => {
        if (entry.kind !== "chat.ask" || !entry.data || typeof entry.data !== "object" || Array.isArray(entry.data)) return false;
        return entry.data.id === requestId;
      });
      if (existingAsk) return;
      const ask: ChatMessage = { id: requestId, authorName, kind: "agent-request", text, createdAt: Date.now() };
      await this.#advanceFollowUpRevision();
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
    await this.#assertActive();
    const servers = await this.#discoverMcpServers(true);
    return { configured: servers.length > 0, servers, tools: servers.flatMap((server) => [...server.tools]) };
  }

  async deleteWorkspace(): Promise<void> {
    this.#deleted = true;
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.close(1008, "Workspace deleted"); } catch { /* The connection is already closed. */ }
    }
    await this.#stopBroadcastWatch();
    await this.#serialize(async () => {
      if (await this.ctx.storage.get<boolean>(DELETED_WORKSPACE_KEY)) {
        await this.ctx.storage.deleteAlarm();
        return;
      }
      const harness = await this.#ready;
      if (harness) await harness.close(BACKGROUND_CONTEXT);
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.put(DELETED_WORKSPACE_KEY, true);
    });
  }

  async alarm(): Promise<void> {
    const harness = await this.#activeHarness();
    harness.resume();
    await harness.waitForIdle(BACKGROUND_CONTEXT);
    await this.#refreshWakeupAlarm(harness);
  }

  #hasOpenWebSockets(): boolean {
    return this.ctx.getWebSockets().some((socket) => socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING);
  }

  async #ensureBroadcastWatch(): Promise<ConversationWatch> {
    if (this.#broadcastWatch) return this.#broadcastWatch;
    if (this.#watchStarting) return this.#watchStarting;
    const starting = this.#startBroadcastWatch();
    this.#watchStarting = starting;
    try { return await starting; }
    finally { if (this.#watchStarting === starting) this.#watchStarting = undefined; }
  }

  async #startBroadcastWatch(): Promise<ConversationWatch> {
    const root = await (await this.#activeHarness()).root(BACKGROUND_CONTEXT);
    const workspaceInfo = await this.getWorkspace();
    this.#workspaceInfo = workspaceInfo;
    const watch = await root.watch(BACKGROUND_CONTEXT);
    this.#broadcastWatch = watch;
    await this.#broadcastSnapshot(snapshotFromView(watch.value, workspaceInfo));
    watch.start(async (view) => this.#broadcastSnapshot(snapshotFromView(view, workspaceInfo)));
    void watch.closed.then((end) => {
      if (this.#broadcastWatch !== watch) return;
      this.#broadcastWatch = undefined;
      if (end.reason !== "stopped" && !this.#deleted && this.#hasOpenWebSockets()) {
        this.ctx.waitUntil(this.#ensureBroadcastWatch().catch((error) => this.#log("Could not restart the room WebSocket watch", error)));
      }
    });
    return watch;
  }

  async #broadcastSnapshot(snapshot: ReturnType<typeof snapshotFromView>): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) this.#sendSocket(socket, { type: "snapshot", snapshot });
  }

  #sendSocket(socket: WebSocket, message: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try { socket.send(JSON.stringify(message)); }
    catch (error) {
      this.#log("Could not send a room WebSocket frame", error);
      try { socket.close(1011, "Could not send workspace update"); } catch { /* The connection is already closed. */ }
    }
  }

  async #stopBroadcastWatch(): Promise<void> {
    const starting = this.#watchStarting;
    if (starting) await starting.catch(() => undefined);
    const watch = this.#broadcastWatch;
    this.#broadcastWatch = undefined;
    if (watch) await watch.stop();
  }

  async #assertActive(): Promise<void> {
    if (this.#deleted || await this.ctx.storage.get<boolean>(DELETED_WORKSPACE_KEY)) {
      this.#deleted = true;
      throw new Error("Workspace has been deleted.");
    }
  }

  async #activeHarness(): Promise<Harness> {
    await this.#assertActive();
    const harness = await this.#ready;
    if (!harness) throw new Error("Workspace has been deleted.");
    return harness;
  }

  async #openHarness(): Promise<Harness> {
    const schedules = {
      list: () => this.#listSchedules(),
      cancel: (id: string) => this.#cancelSchedule(id),
    };
    const capabilities = {
      listMcpTools: () => this.#getMcpTools(),
      callMcpTool: async (input: { serverId: string; serverName: string; toolName: string; args: Record<string, unknown> }) => {
        const server = (await this.#getMcpServers()).find((item) => item.id === input.serverId && item.name === input.serverName);
        if (!server) throw new Error("The selected MCP server is no longer configured.");
        const advertised = (await this.#getMcpTools()).some((tool) => tool.serverId === server.id && tool.name === input.toolName);
        if (!advertised) throw new Error("That tool is not advertised by the selected MCP server.");
        return callMcpTool(server.url, input.toolName, input.args);
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
    const harness = await this.#activeHarness();
    const messages = messagesFromEntries((await root.context(BACKGROUND_CONTEXT)).entries);
    if (extra) messages.push(extra);
    let tools: McpToolSummary[] = [];
    try { tools = await this.#getMcpTools(); }
    catch (error) { this.#log("MCP tool discovery failed; continuing without MCP", error); }
    await this.#assertActive();
    const workspace = await harness.commit(async (tx) => ({ title: (await tx.doc(WorkspaceInfoDocument)).title }), BACKGROUND_CONTEXT);
    const contextText = promptContext(messages, tools, workspace.title);
    await (await this.#activeHarness()).commit(async (tx) => {
      const doc = await tx.doc(RoomPromptContext);
      doc.text = contextText;
    }, BACKGROUND_CONTEXT);
  }

  async #monitorMessage(message: ChatMessage): Promise<void> {
    const harness = await this.#activeHarness();
    const root = await harness.root(BACKGROUND_CONTEXT);
    const revision = await this.#advanceFollowUpRevision();
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
    await this.#assertActive();

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
    const inspection = await (await this.#activeHarness()).inspect(BACKGROUND_CONTEXT);
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
    const harness = await this.#activeHarness();
    const task = await harness.getTask(taskId as TaskId, BACKGROUND_CONTEXT);
    if (!task || task.kind !== DeliverScheduledInstruction.definition.name) return false;
    const cancelled = await harness.abortTask(taskId as TaskId, BACKGROUND_CONTEXT);
    await this.#refreshWakeupAlarm(harness);
    return cancelled === "marked";
  }

  async #advanceFollowUpRevision(): Promise<number> {
    const harness = await this.#activeHarness();
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
    await this.#refreshWakeupAlarm(harness);
    return revision;
  }

  async #getMcpServers(): Promise<McpServerConfig[]> {
    return this.env.ADMIN.getByName("global").getMcpServers();
  }

  async #discoverMcpServers(refresh = false): Promise<McpServerStatus[]> {
    const configured = await this.#getMcpServers();
    const fingerprint = JSON.stringify(configured.map(({ id, name, url }) => [id, name, url]));
    if (!refresh && this.#mcpCache?.fingerprint === fingerprint && this.#mcpCache.expiresAt > Date.now()) return this.#mcpCache.servers;
    const servers = await Promise.all(configured.map(async (server): Promise<McpServerStatus> => {
      try {
        const tools = (await listMcpTools(server.url)).map((tool) => ({
          serverId: server.id,
          serverName: server.name,
          name: tool.name,
          ...(tool.title === undefined ? {} : { title: tool.title }),
          ...(tool.description === undefined ? {} : { description: tool.description }),
        }));
        return { id: server.id, name: server.name, tools };
      } catch (error) {
        this.#log("MCP tool discovery failed", { serverId: server.id, error });
        return { id: server.id, name: server.name, tools: [], error: error instanceof Error ? error.message : String(error) };
      }
    }));
    this.#mcpCache = { fingerprint, expiresAt: Date.now() + MCP_CACHE_MS, servers };
    return servers;
  }

  async #getMcpTools(): Promise<McpToolSummary[]> {
    return (await this.#discoverMcpServers()).flatMap((server) => [...server.tools]);
  }

  async #finishSubmission(submission: Submission): Promise<void> {
    try {
      const settled = await submission.wait(BACKGROUND_CONTEXT);
      if (settled.status !== "done") this.#log("Agent submission ended without a final answer", settled.status);
      else {
        await this.#assertActive();
        const root = await (await this.#activeHarness()).root(BACKGROUND_CONTEXT);
        const messages = messagesFromEntries((await root.context(BACKGROUND_CONTEXT)).entries);
        const latestGroup = [...messages].reverse().find((message) => message.kind === "group");
        if (latestGroup) await this.#monitorMessage(latestGroup);
        else await this.#advanceFollowUpRevision();
      }
    } catch (error) {
      this.#log("Agent submission failed", error);
    } finally {
      try { await this.#refreshWakeupAlarm(); }
      catch (error) { this.#log("Could not refresh the room alarm", error); }
    }
  }

  async #refreshWakeupAlarm(harness?: Harness): Promise<void> {
    const inspection: HarnessInspection = await (harness ?? await this.#activeHarness()).inspect(BACKGROUND_CONTEXT);
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
