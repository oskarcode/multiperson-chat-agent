import type { MultiPersonChatRpc } from "../chat-rpc";
import type { Env } from "../platform-env";
import type { ChatMessage, Schedule } from "../protocol/chat";
import { defaultAiModel } from "./models";

const formatTranscript = (messages: ChatMessage[]): string =>
  messages.map((message) => `${message.authorName} (${message.kind}): ${message.text}`).join("\n");

const aiText = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["response", "text", "output_text"] as const) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  const result = record.result;
  if (typeof result === "object" && result !== null) {
    const nested = aiText(result);
    if (nested) return nested;
  }
  const choices = record.choices;
  if (Array.isArray(choices)) {
    const parts = choices.flatMap((choice) => {
      if (typeof choice !== "object" || choice === null) return [];
      const message = (choice as Record<string, unknown>).message;
      if (typeof message === "object" && message !== null && typeof (message as Record<string, unknown>).content === "string") return [(message as Record<string, string>).content];
      if (typeof (choice as Record<string, unknown>).text === "string") return [(choice as Record<string, string>).text];
      return [];
    }).filter(Boolean);
    if (parts.length > 0) return parts.join("\n").trim();
  }
  return undefined;
};

type PiSessionRpc = {
  listSchedules(input: { workspaceId: string; workspaceTitle?: string; from?: number; to?: number }): Promise<Schedule[]>;
  createSchedule(input: { actorId: string; workspaceId: string; workspaceTitle?: string; instruction: string; runAt: number }): Promise<Schedule>;
};

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;
type AnthropicMessage = { role: "user" | "assistant"; content: string | unknown[] };

const piSession = (env: Env, workspaceId: string): PiSessionRpc => env.SESSIONS.getByName(workspaceId) as unknown as PiSessionRpc;

const transcriptMessages = (transcript: ChatMessage[], system: string): Array<{ role: "system" | "user" | "assistant"; content: string }> => [
  { role: "system", content: system },
  ...transcript.map((message) => ({
    role: message.kind === "agent" ? "assistant" as const : "user" as const,
    // Human turns keep their author name for group context. Assistant turns do
    // not, because model providers already know they are assistant messages;
    // repeating "Group Agent:" encourages duplicate prefixes in replies.
    content: message.kind === "agent" ? message.text : `${message.authorName}: ${message.text}`,
  })),
];

const anthropicMessages = (transcript: ChatMessage[]): AnthropicMessage[] => transcript.map((message) => ({
  role: message.kind === "agent" ? "assistant" : "user",
  content: message.kind === "agent" ? message.text : `${message.authorName}: ${message.text}`,
}));

const createScheduleTool = {
  name: "create_schedule",
  description: "Create one reminder in the current chat room. Use this when a user asks to be reminded or asks to schedule something.",
  input_schema: {
    type: "object",
    properties: {
      instruction: { type: "string", description: "The reminder text to deliver later. Keep the user's intended task, but remove scheduling words like 'remind me'." },
      runAt: { type: "integer", description: "Unix timestamp in milliseconds when the reminder should run. Must be in the future." },
    },
    required: ["instruction", "runAt"],
    additionalProperties: false,
  },
} as const;

const textFromAnthropic = (content: readonly AnthropicContentBlock[] | undefined): string | undefined => {
  const text = content?.flatMap((part) => part.type === "text" && part.text ? [part.text] : []).join("\n").trim();
  return text ? text : undefined;
};

const toolUsesFromAnthropic = (content: readonly AnthropicContentBlock[] | undefined): AnthropicToolUseBlock[] =>
  content?.filter((part): part is AnthropicToolUseBlock => part.type === "tool_use") ?? [];

const runScheduleTool = async (env: Env, actorId: string, workspaceId: string, workspaceTitle: string | undefined, tool: AnthropicToolUseBlock): Promise<unknown> => {
  if (tool.name !== "create_schedule") return { ok: false, error: `Unknown tool ${tool.name}` };
  const input = typeof tool.input === "object" && tool.input !== null ? tool.input as Record<string, unknown> : {};
  const instruction = typeof input.instruction === "string" ? input.instruction.trim() : "";
  const runAt = typeof input.runAt === "number" ? input.runAt : Number(input.runAt);
  if (instruction.length === 0) return { ok: false, error: "instruction is required" };
  if (!Number.isFinite(runAt)) return { ok: false, error: "runAt must be a Unix timestamp in milliseconds" };
  try {
    const schedule = await piSession(env, workspaceId).createSchedule({ actorId, workspaceId, workspaceTitle, instruction, runAt });
    return { ok: true, schedule };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export async function generateAgentReply(env: Env, chat: MultiPersonChatRpc, actorId: string, workspaceId: string): Promise<string> {
  const transcript = await chat.recentTranscript({ actorId, workspaceId, limit: 24 });
  const workspaces = await chat.listWorkspaces(actorId);
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const [connectors, skills, schedules] = await Promise.all([
    chat.listConnectors(actorId),
    chat.listSkills(actorId),
    piSession(env, workspaceId).listSchedules({ workspaceId, workspaceTitle: workspace?.title, from: Date.now(), to: Date.now() + 14 * 24 * 60 * 60 * 1000 }),
  ]);
  const connectorNote = connectors.length === 0
    ? "No MCP connectors are configured yet."
    : `Configured MCP connectors (not invoked automatically yet): ${connectors.map((connector) => `${connector.label} (${connector.status})`).join(", ")}.`;
  const enabledSkills = skills.filter((skill) => skill.enabled);
  const skillNote = enabledSkills.length === 0
    ? "No group skills are enabled yet."
    : `Enabled group skills: ${enabledSkills.map((skill) => `${skill.title} (${skill.slug}): ${skill.description}`).join("; ")}.`;
  const scheduleNote = schedules.length === 0
    ? "No upcoming group schedules are saved."
    : `Upcoming group schedules: ${schedules.slice(0, 12).map((schedule) => `${new Date(schedule.runAt).toISOString()} ${schedule.workspaceTitle ?? "Room"}: ${schedule.instruction}`).join("; ")}.`;
  const scheduleCapability = `You can create reminders in the current room by calling the create_schedule tool. Current time: ${new Date().toISOString()} (${Date.now()} ms since epoch). If the user asks for a relative time like "in 1 minute", compute a concrete future runAt timestamp and call the tool. Do not claim that you created, saved, scheduled, or will deliver a reminder unless the schedule tool result says ok.`;
  const system = `You are Group Agent, a warm resident AI participant in a private group chat. Humans can talk to each other without you. You respond only when asked through Ask Agent. Be concise, practical, group-friendly, and transparent about uncertainty. Answer directly; do not start with "Group Agent:" or your own name. Use short Markdown lists when they make the answer easier to scan. Current room: ${workspace?.title ?? "Room"}. ${connectorNote} ${skillNote} ${scheduleNote} ${scheduleCapability}`;
  const prompt = `${system}\n\nRecent conversation:\n${formatTranscript(transcript)}\n\nAnswer directly without a name prefix.`;
  const messages = transcriptMessages(transcript, system);

  const settings = await chat.getAiRuntimeSettings(actorId);
  const provider = settings?.provider ?? "workers-ai";
  const model = settings?.model ?? defaultAiModel(env);
  let failureDetail = "";
  try {
    if (provider === "anthropic") {
      if (!settings?.apiKey) return "I’m ready to use Claude, but an owner/admin still needs to save an Anthropic API key in Connections → Agent model.";
      const baseMessages = anthropicMessages(transcript);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": settings.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 800, system, messages: baseMessages, tools: [createScheduleTool] }),
      });
      const data = await response.json() as { content?: AnthropicContentBlock[]; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || `Anthropic request failed (${response.status})`);

      const toolUses = toolUsesFromAnthropic(data.content);
      if (toolUses.length > 0) {
        const toolResults = await Promise.all(toolUses.map(async (tool) => ({
          type: "tool_result",
          tool_use_id: tool.id,
          content: JSON.stringify(await runScheduleTool(env, actorId, workspaceId, workspace?.title, tool)),
        })));
        const finalResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": settings.apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model,
            max_tokens: 800,
            system,
            messages: [
              ...baseMessages,
              { role: "assistant", content: data.content },
              { role: "user", content: toolResults },
            ],
          }),
        });
        const finalData = await finalResponse.json() as { content?: AnthropicContentBlock[]; error?: { message?: string } };
        if (!finalResponse.ok) throw new Error(finalData.error?.message || `Anthropic follow-up failed (${finalResponse.status})`);
        const finalText = textFromAnthropic(finalData.content);
        if (finalText) return finalText;
      }

      const text = textFromAnthropic(data.content);
      if (text) return text;
    } else {
      const options = env.AI_GATEWAY_ID?.trim() ? { gateway: { id: env.AI_GATEWAY_ID.trim(), skipCache: true } } : undefined;
      let response: unknown;
      try {
        response = await env.AI.run(model, { messages }, options as never);
      } catch (messageError) {
        console.warn(JSON.stringify({ message: "Workers AI messages input failed; retrying prompt input", model, error: messageError instanceof Error ? messageError.message : String(messageError) }));
        response = await env.AI.run(model, { prompt }, options as never);
      }
      const text = aiText(response);
      if (text && text.trim().length > 0) return text.trim();
    }
  } catch (error) {
    failureDetail = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ message: "AI request failed", provider, model, error: failureDetail }));
  }
  return provider === "anthropic"
    ? `I’m here with the group, but I could not reach Anthropic with the saved Claude settings. Check the API key/model in Connections → Agent model.${failureDetail ? ` Details: ${failureDetail}` : ""}`
    : `I’m here with the group, but I could not reach Workers AI model ${model} from this deployment. Try GLM-4.7 Flash or Llama 3.1 8B, configure an AI Gateway with unified billing, or switch to Claude with your own Anthropic API key.${failureDetail ? ` Details: ${failureDetail}` : ""}`;
}
