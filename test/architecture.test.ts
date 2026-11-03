import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("demo architecture", () => {
  it("keeps one room-scoped Durable Object and Pi Durable as the real agent runtime", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string> };
    for (const dependency of ["@earendil-works/pi-durable", "@earendil-works/pi-ai", "@earendil-works/chord", "@earendil-works/pi-mcp", "agents", "hono"]) {
      expect(pkg.dependencies?.[dependency]).toBeTruthy();
    }
    expect(existsSync("src/session/chat-room.ts")).toBe(true);
    expect(existsSync("src/session/harness.ts")).toBe(true);
    expect(existsSync("src/session/schedule-task.ts")).toBe(true);
    expect(existsSync("src/session/follow-up-task.ts")).toBe(true);
    expect(existsSync("src/http")).toBe(false);
    expect(existsSync("src/auth")).toBe(false);
    expect(existsSync("src/durable")).toBe(false);
    expect(existsSync("src/chat-rpc.ts")).toBe(false);

    const task = readFileSync("src/session/schedule-task.ts", "utf8");
    expect(task).toContain("runtime.conversation");
    expect(task).toContain("conversation.submit");
    const followUp = readFileSync("src/session/follow-up-task.ts", "utf8");
    expect(followUp).toContain("conversation.submit");
    const harness = readFileSync("src/session/harness.ts", "utf8");
    expect(harness).toContain('provider: "cloudflare"');
    expect(harness).not.toContain("anthropic");

    const wrangler = JSON.parse(readFileSync("wrangler.jsonc", "utf8")) as {
      durable_objects: { bindings: { name: string; class_name: string }[] };
      exports: Record<string, { state?: string; storage?: string }>;
    };
    expect(wrangler.durable_objects.bindings).toEqual([
      { name: "ROOMS", class_name: "ChatRoom" },
      { name: "ADMIN", class_name: "DemoAdmin" },
    ]);
    expect(wrangler.exports.ChatRoom.storage).toBe("sqlite");
    expect(wrangler.exports.DemoAdmin.storage).toBe("sqlite");
    expect(wrangler.exports.MultiPersonChat.state).toBe("deleted");
    expect(wrangler.exports.PiSession.state).toBe("deleted");
  });

  it("uses hibernatable WebSockets to broadcast Pi Durable conversation snapshots", () => {
    const room = readFileSync("src/session/chat-room.ts", "utf8");
    expect(room).toContain("root.watch(BACKGROUND_CONTEXT)");
    expect(room).toContain("watch.start");
    expect(room).toContain("this.ctx.acceptWebSocket(server)");
    expect(room).toContain("this.ctx.getWebSockets()");
    expect(room).toContain("async webSocketMessage(");
    expect(room).not.toContain("setInterval(");
    const index = readFileSync("src/index.ts", "utf8");
    expect(index).toContain('import { Hono } from "hono"');
    expect(index).toContain("/socket");
    expect(index).not.toContain("text/event-stream");
    expect(readFileSync("src/session/transcript.ts", "utf8")).toContain('view.docs["pi.live"]');
    expect(readFileSync("src/ui/page.ts", "utf8")).toContain('id="activityPanel"');
    expect(readFileSync("src/admin/demo-admin.ts", "utf8")).toContain("createWorkspace");
  });
});
