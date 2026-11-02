import { createAI } from "agents/models/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { describe, expect, it } from "vitest";
import { AI_MODELS, DEFAULT_WORKERS_AI_MODEL } from "../src/agent/models";

describe("AI model catalog", () => {
  it("uses Workers AI models supported by the Pi AI provider", async () => {
    const provider = createAI({ binding: { run: async () => new Response() } as never }).provider;
    const supported = new Set((await provider.getModels()).map((model) => model.id));
    for (const model of AI_MODELS.filter((choice) => choice.provider === "workers-ai")) {
      expect(supported.has(model.id), `${model.id} is not registered by the Pi AI provider`).toBe(true);
    }
    expect(supported.has(DEFAULT_WORKERS_AI_MODEL)).toBe(true);
  });

  it("does not offer retired Claude 3.5 aliases", async () => {
    const anthropicIds = AI_MODELS.filter((model) => model.provider === "anthropic").map((model) => model.id);
    const supported = new Set((await anthropicProvider().getModels()).map((model) => model.id));
    for (const id of anthropicIds) expect(supported.has(id), `${id} is not registered by Pi AI`).toBe(true);
    expect(anthropicIds).toContain("claude-haiku-4-5-20251001");
    expect(anthropicIds).toContain("claude-sonnet-4-5-20250929");
    expect(anthropicIds).not.toContain("claude-3-5-haiku-latest");
    expect(anthropicIds).not.toContain("claude-3-5-sonnet-latest");
  });
});
