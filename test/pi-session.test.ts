import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, MemoryStorage } from "@earendil-works/pi-durable";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/platform-env";
import { SessionCredentialStore } from "../src/session/credentials";
import { createStarterHarnessOptions } from "../src/session/harness";
import { RoomPromptContext } from "../src/session/room-context";
import { DeliverProactiveFollowUp, FollowUpCursor } from "../src/session/follow-up-task";
import { messageNeedsFollowUp } from "../src/session/follow-up-classifier";

describe("Pi Durable room agent", () => {
  it("runs Ask Agent through Pi AI and exposes native room capability tools", async () => {
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
      }, {
        callConnector: async () => ({ ok: true }),
        readSkillFile: async ({ slug, path = "SKILL.md" }) => ({ path, content: `${slug} instructions` }),
      }),
      BACKGROUND_CONTEXT,
    );
    try {
      await harness.commit(async (tx) => {
        const room = await tx.doc(RoomPromptContext);
        room.workspaceId = "room-test";
        room.workspaceTitle = "Test room";
        room.actorId = "member-test";
        room.publicOrigin = "https://test.example";
        room.text = "The room context is available to the Pi prompt.";
      }, BACKGROUND_CONTEXT);
      const conversation = await harness.root(BACKGROUND_CONTEXT);
      await conversation.configure({ model: { provider: "cloudflare", modelId: "@cf/zai-org/glm-4.7-flash" }, thinkingLevel: "off" }, BACKGROUND_CONTEXT);
      const agent = await conversation.agent(BACKGROUND_CONTEXT);
      expect(agent.tools.map((tool) => tool.name)).toEqual(["schedule", "list_schedules", "cancel_schedule", "call_connector_tool", "read_skill_file"]);

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

  it("classifies ambiguous follow-up candidates through Pi AI", async () => {
    const run = vi.fn(async () => new Response([
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"YES"}}]}',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1}}',
      "data: [DONE]",
      "",
    ].join("\n\n"), { headers: { "content-type": "text/event-stream" } }));
    const env = { AI: { run }, AI_MODEL: "@cf/zai-org/glm-4.7-flash" } as unknown as Env;
    const options = createStarterHarnessOptions(env, new SessionCredentialStore(), {
      list: async () => [], cancel: async () => false,
    }, {
      callConnector: async () => ({ ok: true }),
      readSkillFile: async ({ slug, path = "SKILL.md" }) => ({ path, content: `${slug} instructions` }),
    });
    const needsFollowUp = await messageNeedsFollowUp(options.models, "cloudflare", "@cf/zai-org/glm-4.7-flash", {
      id: 1, workspaceId: "room-test", authorId: "member-test", authorName: "Test member", kind: "group",
      text: "The timeline is blocked and we have not chosen an owner.", createdAt: Date.now(),
    }, "Test member: The timeline is blocked and we have not chosen an owner.");
    expect(needsFollowUp).toBe(true);
    expect(run).toHaveBeenCalled();
  });

  it("delivers proactive follow-ups through Pi tasks and ignores stale candidates", async () => {
    const run = vi.fn(async () => new Response([
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"A gentle check-in."}}]}',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":4}}',
      "data: [DONE]",
      "",
    ].join("\n\n"), { headers: { "content-type": "text/event-stream" } }));
    const env = { AI: { run }, AI_MODEL: "@cf/zai-org/glm-4.7-flash" } as unknown as Env;
    const harness = await Harness.open(new MemoryStorage(), createStarterHarnessOptions(env, new SessionCredentialStore(), {
      list: async () => [], cancel: async () => false,
    }, {
      callConnector: async () => ({ ok: true }),
      readSkillFile: async ({ slug, path = "SKILL.md" }) => ({ path, content: `${slug} instructions` }),
    }), BACKGROUND_CONTEXT);
    try {
      const root = await harness.root(BACKGROUND_CONTEXT);
      const taskId = await root.commit(async (tx) => {
        const cursor = await tx.doc(FollowUpCursor);
        cursor.revision = 1;
        return tx.createTask(DeliverProactiveFollowUp, {
          workspaceId: "room-test", conversationId: root.id, triggerRevision: 1,
          authorId: "member-test", authorName: "Test member", message: "Can anyone confirm?",
          recentConversation: "Test member: Can anyone confirm?", dueAt: Date.now() + 20,
        }, { ownership: { kind: "conversation" }, background: true });
      }, BACKGROUND_CONTEXT);
      harness.resume();
      const receipt = await harness.waitForTask(taskId, BACKGROUND_CONTEXT);
      expect(receipt.state.status).toBe("terminal");
      const delivered = await root.context(BACKGROUND_CONTEXT);
      expect(delivered.entries.some((entry) => entry.kind === "pi.user" && entry.model?.some((message) => message.role === "user" && typeof message.content === "string" && message.content.includes("Group Agent proactive follow-up")))).toBe(true);
      expect(delivered.entries.some((entry) => entry.kind === "pi.assistant" && entry.model?.some((message) => message.role === "assistant" && message.content.some((part) => part.type === "text" && part.text === "A gentle check-in.")))).toBe(true);

      const staleId = await root.commit(async (tx) => {
        const cursor = await tx.doc(FollowUpCursor);
        cursor.revision = 2;
        return tx.createTask(DeliverProactiveFollowUp, {
          workspaceId: "room-test", conversationId: root.id, triggerRevision: 1,
          authorId: "member-test", authorName: "Test member", message: "Already resolved",
          recentConversation: "A newer message arrived.", dueAt: Date.now() + 20,
        }, { ownership: { kind: "conversation" }, background: true });
      }, BACKGROUND_CONTEXT);
      const stale = await harness.waitForTask(staleId, BACKGROUND_CONTEXT);
      expect(stale.state.status).toBe("terminal");
      const afterStale = await root.context(BACKGROUND_CONTEXT);
      expect(afterStale.entries.some((entry) => entry.kind === "pi.user" && entry.model?.some((message) => message.role === "user" && typeof message.content === "string" && message.content.includes("Already resolved")))).toBe(false);
    } finally {
      await harness.close(BACKGROUND_CONTEXT);
    }
  });
});
