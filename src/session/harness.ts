import { createModels } from "@earendil-works/pi-ai/models";
import { configure, createRegistry, defineExtension, section, type HarnessOptions } from "@earendil-works/pi-durable";

export const STARTER_AGENT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

// Minimal Pi Durable harness configuration. The current HTTP API still serves the
// legacy transcript while we migrate one responsibility at a time; this file is
// the new composition point for Pi Durable sections, tools, and tasks.
export function createStarterHarnessOptions(): HarnessOptions {
  const models = createModels();
  const chatExtension = defineExtension({
    name: "multiperson-chat",
    sections: [
      section("preamble", () => "You are Group Agent, a warm resident AI participant in a private group chat.", { tag: false }),
      section("clock", () => `Current time: ${new Date().toISOString().slice(0, 16)}Z.`, { tag: false }),
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
            model: { provider: "cloudflare", modelId: STARTER_AGENT_MODEL },
            thinkingLevel: "off",
          })
        : undefined,
  };
}
