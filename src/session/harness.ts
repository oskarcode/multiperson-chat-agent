import { createAI } from "agents/models/pi-ai";
import { configure, createRegistry, defineExtension, section, type HarnessOptions, type ToolRegistration } from "@earendil-works/pi-durable";
import { createModels } from "@earendil-works/pi-ai/models";
import type { Env } from "../platform-env";
import { DEFAULT_WORKERS_AI_MODEL } from "../agent/models";
import { createCapabilityTools, type AgentCapabilityOperations } from "./capability-tools";
import { DeliverProactiveFollowUp } from "./follow-up-task";
import { RoomPromptContext } from "./room-context";
import { DeliverScheduledInstruction } from "./schedule-task";
import { createScheduleTools, type ScheduleToolOperations } from "./schedule-tools";

export const STARTER_AGENT_MODEL = DEFAULT_WORKERS_AI_MODEL;

/** Compose the Workers AI provider, room prompt, Pi tools, and durable tasks. */
export function createStarterHarnessOptions(
  env: Env,
  schedules: ScheduleToolOperations,
  capabilities: AgentCapabilityOperations,
): HarnessOptions {
  const models = createModels();
  if (env.AI !== undefined) models.setProvider(createAI({ binding: env.AI, id: env.AI_GATEWAY_ID }).provider);

  const tools: ToolRegistration[] = [...createScheduleTools(schedules), ...createCapabilityTools(capabilities)];
  const roomAgent = defineExtension({
    name: "multiperson-chat",
    tasks: [DeliverScheduledInstruction, DeliverProactiveFollowUp],
    tools,
    sections: [
      section("preamble", () => "You are Group Agent, a warm, practical participant in a public group chat. Answer directly and concisely. Never claim an action succeeded unless a Pi tool reports success.", { tag: false }),
      section("clock", () => `Current time: ${new Date().toISOString()}.`, { tag: false }),
      section("room-context", async (input, context) => (await input.read.snapshot(RoomPromptContext, context))?.text || undefined, { tag: false }),
    ],
  });
  const registry = createRegistry();
  registry.install(roomAgent);

  return {
    models,
    registry,
    settings: {
      extensions: [roomAgent],
      documentRetentionMs: 0,
      progress: { partialIntervalMs: 100, outputIntervalMs: 100 },
    },
    conversationCreated: (tx, conversation) => conversation.owner === undefined && conversation.parent === undefined
      ? configure(tx, conversation.id, {
          model: { provider: "cloudflare", modelId: env.AI_MODEL?.trim() || STARTER_AGENT_MODEL },
          thinkingLevel: "off",
          tools,
        })
      : undefined,
    onReport: (error) => console.error(JSON.stringify({ message: "Pi Durable task failed", error: error instanceof Error ? error.message : String(error) })),
  };
}
