import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("architecture guardrails", () => {
  it("records Pi Durable as the preferred agent runtime direction", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.["@earendil-works/pi-durable"]).toBeTruthy();
    expect(pkg.dependencies?.["@earendil-works/pi-ai"]).toBeTruthy();
    expect(pkg.dependencies?.["@earendil-works/chord"]).toBeTruthy();

    const agentGuide = readFileSync("AGENTS.md", "utf8");
    expect(agentGuide).toContain("prefer Pi Durable primitives");
    expect(agentGuide).toContain("Do not add manual replacements");
  });

  it("does not reintroduce ad-hoc schedule parsing", () => {
    expect(existsSync("src/agent/schedule-request.ts")).toBe(false);
  });
});
