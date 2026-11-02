import type { MultiPersonChatRpc } from "../chat-rpc";
import type { Env } from "../platform-env";
import type { Schedule } from "../protocol/chat";

type PiSessionContextRpc = {
  listSchedules(input: { workspaceId: string; workspaceTitle?: string; from?: number; to?: number }): Promise<Schedule[]>;
};

const piSession = (env: Env, workspaceId: string): PiSessionContextRpc => env.SESSIONS.getByName(workspaceId) as unknown as PiSessionContextRpc;

/** Builds the app-specific room context passed into Pi Durable's prompt sections. */
export async function buildAgentPromptContext(env: Env, chat: MultiPersonChatRpc, actorId: string, workspaceId: string): Promise<string> {
  const [transcript, workspaces, connectors, skills, schedules] = await Promise.all([
    chat.recentTranscript({ actorId, workspaceId, limit: 24 }),
    chat.listWorkspaces(actorId),
    chat.listConnectors(actorId),
    chat.listSkills(actorId),
    piSession(env, workspaceId).listSchedules({ workspaceId, from: Date.now(), to: Date.now() + 14 * 24 * 60 * 60 * 1000 }),
  ]);
  const room = workspaces.find((item) => item.id === workspaceId);
  const enabledSkills = skills.filter((skill) => skill.enabled);
  const recentMessages = transcript
    .filter((message) => message.kind !== "agent-request")
    .map((message) => `${message.authorName} (${message.kind}): ${message.text}`)
    .join("\n");
  const connectorContext = connectors.length === 0
    ? "No MCP connectors are configured."
    : `Configured MCP connectors (tools are not yet exposed to the Pi agent): ${connectors.map((connector) => `${connector.label} (${connector.status})`).join(", ")}.`;
  const skillContext = enabledSkills.length === 0
    ? "No group skills are enabled."
    : `Enabled group skills: ${enabledSkills.map((skill) => `${skill.title} (${skill.slug}): ${skill.description}`).join("; ")}.`;
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
