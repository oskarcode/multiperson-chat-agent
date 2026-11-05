import { describe, expect, it } from "vitest";
import { DEFAULT_WORKERS_AI_MODEL } from "../src/agent/models";
import { STARTER_AGENT_MODEL } from "../src/session/harness";

describe("Workers AI demo model", () => {
  it("uses one Workers AI model as the only provider default", () => {
    expect(DEFAULT_WORKERS_AI_MODEL).toBe("@cf/zai-org/glm-5.3");
    expect(STARTER_AGENT_MODEL).toBe(DEFAULT_WORKERS_AI_MODEL);
  });
});
