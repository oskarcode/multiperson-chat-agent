import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("architecture guardrails", () => {
  it("records Pi Durable as the preferred agent runtime direction", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.["@earendil-works/pi-durable"]).toBeTruthy();
    expect(pkg.dependencies?.["@earendil-works/pi-ai"]).toBeTruthy();
    expect(pkg.dependencies?.["@earendil-works/chord"]).toBeTruthy();
    expect(existsSync("src/session/pi-session.ts")).toBe(true);
    expect(existsSync("src/session/harness.ts")).toBe(true);
    expect(existsSync("src/session/schedule-task.ts")).toBe(true);
    expect(existsSync("src/durable/features/schedules.ts")).toBe(false);

    const wrangler = readFileSync("wrangler.jsonc", "utf8");
    expect(wrangler).toContain('"name": "SESSIONS"');
    expect(wrangler).toContain('"class_name": "PiSession"');

    const agentGuide = readFileSync("AGENTS.md", "utf8");
    expect(agentGuide).toContain("prefer Pi Durable primitives");
    expect(agentGuide).toContain("Do not add manual replacements");
    expect(agentGuide).toContain("https://earendil.com/posts/pi-durable-on-cloudflare/");
    expect(agentGuide).toContain("A task that only sleeps and completes is not delivery.");
    expect(agentGuide).toContain("Preserve feature parity during migration.");
  });

  it("does not reintroduce ad-hoc schedule parsing", () => {
    expect(existsSync("src/agent/schedule-request.ts")).toBe(false);
  });
});
