import type { JsonValue } from "@earendil-works/chord";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ConversationView, EntryRecord, LiveState } from "@earendil-works/pi-durable";
import type { ChatMessage, McpToolSummary, RoomSnapshot, WorkspaceInfo } from "../protocol/chat";

function record(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function textContent(message: AssistantMessage): string {
  return message.content.flatMap((part) => part.type === "text" && part.text.trim() ? [part.text.trim()] : []).join("\n").trim();
}

function appMessage(entry: EntryRecord): ChatMessage | undefined {
  const data = record(entry.data);
  if (!data) return undefined;
  const authorName = typeof data.authorName === "string" ? data.authorName : undefined;
  const text = typeof data.text === "string" ? data.text : undefined;
  const createdAt = typeof data.createdAt === "number" ? data.createdAt : 0;
  if (text === undefined) return undefined;

  if (entry.kind === "chat.message" && authorName) {
    return { id: String(data.id ?? entry.id), authorName, kind: "group", text, createdAt };
  }
  if (entry.kind === "chat.ask" && authorName) {
    return { id: String(data.id ?? entry.id), authorName, kind: "agent-request", text, createdAt };
  }
  if (entry.kind === "chat.reminder") {
    return { id: `reminder:${entry.id}`, authorName: "Scheduled reminder", kind: "system", text, createdAt };
  }
  if (entry.kind === "chat.follow-up") {
    return { id: `follow-up:${entry.id}`, authorName: "Group Agent follow-up", kind: "system", text, createdAt };
  }
  return undefined;
}

export function messagesFromEntries(entries: readonly EntryRecord[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const entry of entries) {
    const app = appMessage(entry);
    if (app) {
      messages.push(app);
      continue;
    }
    if (entry.kind !== "pi.assistant") continue;
    const assistant = entry.model?.find((message): message is AssistantMessage => message.role === "assistant");
    if (!assistant || assistant.stopReason === "toolUse" || assistant.stopReason === "pending") continue;
    const text = textContent(assistant);
    if (text) messages.push({ id: `agent:${entry.id}`, authorName: "Group Agent", kind: "agent", text, createdAt: assistant.timestamp });
  }
  return messages.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export function snapshotFromView(view: ConversationView, workspaceInfo?: WorkspaceInfo | null): RoomSnapshot {
  const live = view.docs["pi.live"] as LiveState | undefined;
  const partial = live?.generation?.message;
  const partialText = partial ? textContent(partial) : "";
  const toolCallNames = new Map<string, string>();
  for (const entry of view.entries) {
    if (entry.kind !== "pi.assistant") continue;
    for (const message of entry.model ?? []) {
      if (message.role !== "assistant") continue;
      for (const part of message.content) {
        if (part.type !== "toolCall") continue;
        const requestedName = part.name === "call_mcp_tool" && typeof part.arguments.toolName === "string"
          ? `${typeof part.arguments.serverName === "string" ? `${part.arguments.serverName} · ` : ""}${part.arguments.toolName}` : part.name;
        toolCallNames.set(part.id, requestedName);
      }
    }
  }
  const tools = [...(live?.tools ?? []), ...(live?.nestedTools ?? [])].map((tool) => {
    const nestedName = "arguments" in tool && tool.name === "call_mcp_tool" && typeof tool.arguments.toolName === "string"
      ? `${typeof tool.arguments.serverName === "string" ? `${tool.arguments.serverName} · ` : ""}${tool.arguments.toolName}` : undefined;
    return {
      id: tool.callId,
      name: toolCallNames.get(tool.callId) ?? nestedName ?? tool.name,
      status: tool.status,
    };
  });
  const active = live?.run !== undefined;
  const phase = !active ? "idle"
    : live?.generation?.retry ? "retrying"
      : live?.generation?.deferred ? "waiting"
        : tools.some((tool) => tool.status === "pending" || tool.status === "running") ? "using-tools"
          : live?.generation ? "responding" : "starting";
  const workspace = workspaceInfo ?? view.docs["app.workspace-info"] as WorkspaceInfo | undefined;
  return {
    ...(workspace?.id ? { workspace } : {}),
    messages: messagesFromEntries(view.entries),
    progress: { active, phase, partialText, tools },
  };
}

export function promptContext(messages: readonly ChatMessage[], tools: readonly McpToolSummary[], workspaceTitle?: string): string {
  const recent = messages.slice(-30).map((message) => `${message.authorName} (${message.kind}): ${message.text}`).join("\n").slice(-8000);
  const toolList = tools.map((tool) => {
    const title = tool.title && tool.title !== tool.name ? ` (${tool.title})` : "";
    return `- serverId=${tool.serverId} · server=${tool.serverName} · tool=${tool.name}${title}${tool.description ? `: ${tool.description}` : ""}`;
  }).join("\n");
  return [
    workspaceTitle ? `Workspace: ${workspaceTitle}` : undefined,
    recent ? `Recent room conversation:\n${recent}` : "No earlier room messages.",
    toolList ? `Available public MCP tools. Supply the exact serverId, server name, and tool name; names can overlap across servers:\n${toolList}` : "No MCP tools are currently configured.",
  ].join("\n\n");
}
