import { createAI } from "agents/models/pi-ai";
import { configure, createRegistry, defineExtension, section, type HarnessOptions, type ToolRegistration } from "@earendil-works/pi-durable";
import { createModels } from "@earendil-works/pi-ai/models";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import type { CredentialStore } from "@earendil-works/pi-ai";
import type { Env } from "../platform-env";
import { DEFAULT_WORKERS_AI_MODEL } from "../agent/models";
import { createScheduleTools, type ScheduleToolOperations } from "./schedule-tools";
import { RoomPromptContext } from "./room-context";
import { DeliverScheduledInstruction } from "./schedule-task";

export const STARTER_AGENT_MODEL = DEFAULT_WORKERS_AI_MODEL;

// Compose Pi AI providers and Pi Durable tools/tasks for one room session.
export function createStarterHarnessOptions(
  env: Env,
  credentials: CredentialStore,
  scheduleOperations: ScheduleToolOperations,
): HarnessOptions {
  const models = createModels({ credentials });
  if (env.AI !== undefined) {
    const ai = createAI({ binding: env.AI, id: env.AI_GATEWAY_ID });
    models.setProvider(ai.provider);
  }
  models.setProvider(anthropicProvider());

  const tools: ToolRegistration[] = createScheduleTools(scheduleOperations);
  const chatExtension = defineExtension({
    name: "multiperson-chat",
    tasks: [DeliverScheduledInstruction],
    tools,
    sections: [
      section("preamble", () => "You are Group Agent, a warm, practical AI participant in a private group chat. Answer directly, be concise, and do not claim an action succeeded unless its Pi tool returned success.", { tag: false }),
      section("clock", () => `Current time: ${new Date().toISOString()}.`, { tag: false }),
      section("room-context", async (input, context) => (await input.read.snapshot(RoomPromptContext, context))?.text || undefined, { tag: false }),
    ],
  });
  const registry = createRegistry();
  registry.install(chatExtension);

  return {
    models,
    registry,
    settings: {
      extensions: [chatExtension],
      documentRetentionMs: 0,
    },
    conversationCreated: (tx, conversation) =>
      conversation.owner === undefined && conversation.parent === undefined
        ? configure(tx, conversation.id, {
            model: env.AI === undefined
              ? { provider: "anthropic", modelId: "claude-sonnet-4-5-20250929" }
              : { provider: "cloudflare", modelId: env.AI_MODEL?.trim() || STARTER_AGENT_MODEL },
            thinkingLevel: "off",
            tools,
          })
        : undefined,
    onReport: (error) => console.error(JSON.stringify({ message: "Pi Durable agent task failed", error: error instanceof Error ? error.message : String(error) })),
  };
}
