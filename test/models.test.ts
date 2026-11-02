import { describe, expect, it } from "vitest";
import { AI_MODELS } from "../src/agent/models";

describe("AI model catalog", () => {
  it("does not offer retired Claude 3.5 aliases", () => {
    const anthropicIds = AI_MODELS.filter((model) => model.provider === "anthropic").map((model) => model.id);
    expect(anthropicIds).toContain("claude-haiku-4-5-20251001");
    expect(anthropicIds).toContain("claude-sonnet-4-5-20250929");
    expect(anthropicIds).not.toContain("claude-3-5-haiku-latest");
    expect(anthropicIds).not.toContain("claude-3-5-sonnet-latest");
  });
});
