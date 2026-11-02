import type { MultiPersonChatRpc } from "../chat-rpc";
import type { Env } from "../platform-env";
import type { Schedule } from "../protocol/chat";

type PiSessionContextRpc = {
  listSchedules(input: { workspaceId: string; workspaceTitle?: string; from?: number; to?: number }): Promise<Schedule[]>;
};

const piSession = (env: Env, workspaceId: string): PiSessionContextRpc => env.SESSIONS.getByName(workspaceId) as unknown as PiSessionContextRpc;

/** Builds the app-specific room context passed into Pi Durable's prompt sections. */
export async function buildAgentPromptContext(env: Env, chat: MultiPersonChatRpc, actorId: string, workspaceId: string): Promise<string> {
  const [transcript, workspaces, actor, skills, schedules] = await Promise.all([
    chat.recentTranscript({ actorId, workspaceId, limit: 24 }),
    chat.listWorkspaces(actorId),
    chat.getMember(actorId),
    chat.listSkills(actorId),
    piSession(env, workspaceId).listSchedules({ workspaceId, from: Date.now(), to: Date.now() + 14 * 24 * 60 * 60 * 1000 }),
  ]);
  const canUseConnectors = actor?.role === "owner" || actor?.role === "admin";
  const connectors = canUseConnectors ? await chat.listConnectors(actorId) : [];
  const room = workspaces.find((item) => item.id === workspaceId);
  const enabledSkills = skills.filter((skill) => skill.enabled);
  const recentMessages = transcript
    .filter((message) => message.kind !== "agent-request")
    .map((message) => `${message.authorName} (${message.kind}): ${message.text}`)
    .join("\n");
  const connectorContext = !canUseConnectors
    ? "MCP connectors are restricted to owners and admins; do not attempt connector calls."
    : connectors.length === 0
      ? "No MCP connectors are configured."
      : `Configured MCP connectors: ${connectors.map((connector) => {
        const tools = connector.status === "connected" ? connector.tools.slice(0, 20).map((tool) => {
          const schema = JSON.stringify(tool.inputSchema);
          return `${tool.name}: ${tool.description ?? tool.title ?? "No description"}; input schema ${schema.length > 3000 ? `${schema.slice(0, 3000)}…` : schema}`;
        }).join(" | ") : "not connected";
        return `${connector.label} (id ${connector.id}, ${connector.status}): ${tools}`;
      }).join("; ")}. Use the call_connector_tool Pi tool only for a relevant available connector tool; connector authorization still applies.`;
  const skillContext = enabledSkills.length === 0
    ? "No group skills are enabled."
    : `Enabled group skills: ${enabledSkills.map((skill) => `${skill.title} (slug ${skill.slug}): ${skill.description}`).join("; ")}. Use read_skill_file with the skill slug to read its SKILL.md or a referenced file when relevant.`;
  const scheduleContext = schedules.length === 0
    ? "No upcoming reminders are scheduled."
    : `Upcoming room reminders: ${schedules.slice(0, 12).map((schedule) => `${new Date(schedule.runAt).toISOString()}: ${schedule.instruction}`).join("; ")}.`;
  return [
    `Current room: ${room?.title ?? "Room"}. Treat this as a multi-person conversation; attribute statements to their named authors.`,
    recentMessages ? `Recent room conversation:\n${recentMessages}` : "There is no earlier room conversation.",
    connectorContext,
    skillContext,
    scheduleContext,
    "Use Pi tools for scheduling. Never claim an action succeeded unless the corresponding tool returned success.",
  ].join("\n\n");
}
