import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, MemoryStorage } from "@earendil-works/pi-durable";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/platform-env";
import { SessionCredentialStore } from "../src/session/credentials";
import { createStarterHarnessOptions } from "../src/session/harness";
import { RoomPromptContext } from "../src/session/room-context";

describe("Pi Durable room agent", () => {
  it("runs Ask Agent through Pi AI and exposes native schedule tools", async () => {
    const run = vi.fn(async () => new Response([
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"A Pi-native answer."}}]}',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":4}}',
      "data: [DONE]",
      "",
    ].join("\n\n"), { headers: { "content-type": "text/event-stream" } }));
    const env = { AI: { run }, AI_MODEL: "@cf/zai-org/glm-4.7-flash" } as unknown as Env;
    const harness = await Harness.open(
      new MemoryStorage(),
      createStarterHarnessOptions(env, new SessionCredentialStore(), {
        list: async () => [],
        cancel: async () => false,
      }),
      BACKGROUND_CONTEXT,
    );
    try {
      await harness.commit(async (tx) => {
        const room = await tx.doc(RoomPromptContext);
        room.workspaceId = "room-test";
        room.workspaceTitle = "Test room";
        room.actorId = "member-test";
        room.text = "The room context is available to the Pi prompt.";
      }, BACKGROUND_CONTEXT);
      const conversation = await harness.root(BACKGROUND_CONTEXT);
      await conversation.configure({ model: { provider: "cloudflare", modelId: "@cf/zai-org/glm-4.7-flash" }, thinkingLevel: "off" }, BACKGROUND_CONTEXT);
      const agent = await conversation.agent(BACKGROUND_CONTEXT);
      expect(agent.tools.map((tool) => tool.name)).toEqual(["schedule", "list_schedules", "cancel_schedule"]);

      harness.resume();
      const submission = await conversation.submit({
        type: "input",
        requestId: "test-ask-agent",
        content: "Member: Please help the group.",
      }, BACKGROUND_CONTEXT);
      const settled = await submission.wait(BACKGROUND_CONTEXT);
      expect(settled.status).toBe("done");
      const view = await conversation.context(BACKGROUND_CONTEXT);
      const assistant = view.entries
        .filter((entry) => entry.kind === "pi.assistant")
        .flatMap((entry) => entry.model ?? [])
        .find((message) => message.role === "assistant");
      expect(assistant?.role).toBe("assistant");
      if (assistant?.role === "assistant") expect(assistant.content).toContainEqual({ type: "text", text: "A Pi-native answer." });
      expect(run).toHaveBeenCalled();
    } finally {
      await harness.close(BACKGROUND_CONTEXT);
    }
  });
});
