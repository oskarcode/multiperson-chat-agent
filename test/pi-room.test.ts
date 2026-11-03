import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, MemoryStorage } from "@earendil-works/pi-durable";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/platform-env";
import { STARTER_AGENT_MODEL, createStarterHarnessOptions } from "../src/session/harness";
import { DeliverProactiveFollowUp, FollowUpCursor } from "../src/session/follow-up-task";
import { messageNeedsFollowUp } from "../src/session/follow-up-classifier";
import { DeliverScheduledInstruction } from "../src/session/schedule-task";
import { createScheduleTools } from "../src/session/schedule-tools";
import { promptContext, snapshotFromView } from "../src/session/transcript";

const fakeEnv = (run: (...args: unknown[]) => Promise<Response>): Env => ({
  AI: { run },
  AI_MODEL: STARTER_AGENT_MODEL,
} as unknown as Env);

const options = (env: Env) => createStarterHarnessOptions(env, {
  list: async () => [],
  cancel: async () => false,
}, {
  listMcpTools: async () => [{ serverId: "docs-server", serverName: "Public docs", name: "search", description: "Search a public source" }],
  callMcpTool: async () => ({ ok: true }),
});

function response(text: string): Response {
  return new Response([
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content: text } }] })}`,
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 4 } })}`,
    "data: [DONE]",
    "",
  ].join("\n\n"), { headers: { "content-type": "text/event-stream" } });
}

function scheduleToolCallResponse(): Response {
  return new Response([
    `data: ${JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", tool_calls: [{ id: "schedule-call-1", type: "function", function: { name: "schedule", arguments: JSON.stringify({ instruction: "Check the project plan", delaySeconds: 300 }) } }] }, finish_reason: "tool_calls" }] })}`,
    "data: [DONE]",
    "",
  ].join("\n\n"), { headers: { "content-type": "text/event-stream" } });
}

describe("Pi Durable room agent", () => {
  it("names MCP server identity in the prompt when tool names overlap", () => {
    const context = promptContext([], [
      { serverId: "docs-server", serverName: "Product docs", name: "search" },
      { serverId: "code-server", serverName: "Code search", name: "search" },
    ]);
    expect(context).toContain("serverId=docs-server · server=Product docs · tool=search");
    expect(context).toContain("serverId=code-server · server=Code search · tool=search");
  });

  it("turns a five-minute schedule tool call into one durable reminder task", async () => {
    const intent: { schedule?: { id: string; instruction: string; runAt: number } } = {};
    let createdTask: { task: unknown; input: unknown; options: unknown } | undefined;
    const schedule = createScheduleTools({ list: async () => [], cancel: async () => false })[0];
    const now = Date.now();
    const api = {
      taskId: 7,
      conversationId: 1,
      snapshot: async () => undefined,
      commit: async (change: (tx: never) => unknown) => change({
        doc: async () => intent,
        createTask: async (task: unknown, input: unknown, options: unknown) => {
          createdTask = { task, input, options };
          return 27;
        },
      } as never),
    };

    const result = await schedule.execute({ instruction: "Check the project plan", delaySeconds: 300 }, api as never, BACKGROUND_CONTEXT);
    expect(createdTask?.task).toBe(DeliverScheduledInstruction);
    expect(createdTask?.input).toMatchObject({ conversationId: 1, instruction: "Check the project plan", createdAt: expect.any(Number) });
    const runAt = (createdTask?.input as { runAt: number }).runAt;
    expect(runAt).toBeGreaterThanOrEqual(now + 300_000);
    expect(runAt).toBeLessThanOrEqual(Date.now() + 300_000);
    expect(createdTask?.options).toMatchObject({ ownership: { kind: "conversation" }, background: true });
    expect(intent.schedule).toMatchObject({ id: "27", instruction: "Check the project plan", runAt });
    expect(result.output?.[0]).toMatchObject({ type: "text", text: expect.stringContaining("Scheduled reminder 27") });
  });

  it("runs the schedule tool through a model tool call and persists exactly one reminder", async () => {
    const run = vi.fn()
      .mockResolvedValueOnce(scheduleToolCallResponse())
      .mockResolvedValueOnce(response("The reminder is scheduled."));
    const harness = await Harness.open(new MemoryStorage(), options(fakeEnv(run)), BACKGROUND_CONTEXT);
    try {
      const root = await harness.root(BACKGROUND_CONTEXT);
      harness.resume();
      const submitted = await root.submit({ type: "input", requestId: "schedule-through-agent", content: "Guest: Set a reminder in five minutes." }, BACKGROUND_CONTEXT);
      expect((await submitted.wait(BACKGROUND_CONTEXT)).status).toBe("done");
      expect(run).toHaveBeenCalledTimes(2);
      const scheduled = (await harness.inspect(BACKGROUND_CONTEXT)).tasks.filter((task) => task.record.kind === DeliverScheduledInstruction.definition.name);
      expect(scheduled).toHaveLength(1);
      expect((scheduled[0].record.input as { instruction: string }).instruction).toBe("Check the project plan");
      const view = await root.context(BACKGROUND_CONTEXT);
      expect(view.entries.some((entry) => entry.kind === "pi.assistant" && entry.model?.some((message) => message.role === "assistant" && message.content.some((part) => part.type === "text" && part.text === "The reminder is scheduled.")))).toBe(true);
    } finally { await harness.close(BACKGROUND_CONTEXT); }
  });

  it("uses Workers AI and registers reminder plus public MCP tools", async () => {
    const run = vi.fn(async () => response("A Pi-native answer."));
    const harness = await Harness.open(new MemoryStorage(), options(fakeEnv(run)), BACKGROUND_CONTEXT);
    try {
      const conversation = await harness.root(BACKGROUND_CONTEXT);
      const agent = await conversation.agent(BACKGROUND_CONTEXT);
      expect(agent.model).toEqual({ provider: "cloudflare", modelId: STARTER_AGENT_MODEL });
      expect(agent.tools.map((tool) => tool.name)).toEqual(["schedule", "list_schedules", "cancel_schedule", "call_mcp_tool"]);
      harness.resume();
      const submission = await conversation.submit({ type: "input", requestId: "ask-one", content: "Guest: Help our room." }, BACKGROUND_CONTEXT);
      expect((await submission.wait(BACKGROUND_CONTEXT)).status).toBe("done");
      const view = await conversation.context(BACKGROUND_CONTEXT);
      expect(view.entries.some((entry) => entry.kind === "pi.assistant" && entry.model?.some((message) => message.role === "assistant" && message.content.some((part) => part.type === "text" && part.text === "A Pi-native answer.")))).toBe(true);
      expect(run).toHaveBeenCalled();
    } finally { await harness.close(BACKGROUND_CONTEXT); }
  });

  it("classifies ambiguous open turns through Workers AI", async () => {
    const run = vi.fn(async () => response("YES"));
    const configured = options(fakeEnv(run));
    const harness = await Harness.open(new MemoryStorage(), configured, BACKGROUND_CONTEXT);
    try {
      const needsFollowUp = await messageNeedsFollowUp(configured.models, STARTER_AGENT_MODEL, {
        id: "message-1", authorName: "Guest", kind: "group", text: "The plan still needs an owner.", createdAt: Date.now(),
      }, "Guest: The plan still needs an owner.");
      expect(needsFollowUp).toBe(true);
      expect(run).toHaveBeenCalled();
    } finally { await harness.close(BACKGROUND_CONTEXT); }
  });

  it("reviews later replies before following up on an explicit question", async () => {
    let reviewPrompt = "";
    const run = vi.fn(async (...args: unknown[]) => {
      reviewPrompt = JSON.stringify(args);
      return response("NO");
    });
    const configured = options(fakeEnv(run));
    const harness = await Harness.open(new MemoryStorage(), configured, BACKGROUND_CONTEXT);
    try {
      const needsFollowUp = await messageNeedsFollowUp(configured.models, STARTER_AGENT_MODEL, {
        id: "question-1", authorName: "Guest", kind: "group", text: "Can someone confirm the time?", createdAt: Date.now(),
      }, "Guest: Can someone confirm the time?\nAlice: Yes, 2 PM works for me.");
      expect(needsFollowUp).toBe(false);
      expect(run).toHaveBeenCalledOnce();
      expect(reviewPrompt).toContain("A question mark alone is not enough.");
      expect(reviewPrompt).toContain("Yes, 2 PM works for me");
    } finally { await harness.close(BACKGROUND_CONTEXT); }
  });

  it("delivers due reminders through the same room conversation", async () => {
    const run = vi.fn(async () => response("I will remind the room."));
    const harness = await Harness.open(new MemoryStorage(), options(fakeEnv(run)), BACKGROUND_CONTEXT);
    try {
      const root = await harness.root(BACKGROUND_CONTEXT);
      const taskId = await root.commit((tx) => tx.createTask(DeliverScheduledInstruction, {
        conversationId: root.id,
        instruction: "Check the room task delivery",
        runAt: Date.now() + 25,
        createdAt: Date.now(),
      }, { ownership: { kind: "conversation" }, background: true }), BACKGROUND_CONTEXT);
      harness.resume();
      const result = await harness.waitForTask(taskId, BACKGROUND_CONTEXT);
      expect(result.state.status).toBe("terminal");
      const view = await root.context(BACKGROUND_CONTEXT);
      expect(view.entries.some((entry) => entry.kind === "chat.reminder" && (entry.data as { instruction?: string }).instruction === "Check the room task delivery")).toBe(true);
      expect(view.entries.some((entry) => entry.kind === "pi.assistant" && entry.model?.some((message) => message.role === "assistant" && message.content.some((part) => part.type === "text" && part.text === "I will remind the room.")))).toBe(true);
    } finally { await harness.close(BACKGROUND_CONTEXT); }
  });

  it("delivers proactive follow-ups and discards a candidate when the room changes", async () => {
    const run = vi.fn(async () => response("A gentle check-in."));
    const harness = await Harness.open(new MemoryStorage(), options(fakeEnv(run)), BACKGROUND_CONTEXT);
    try {
      const root = await harness.root(BACKGROUND_CONTEXT);
      const taskId = await root.commit(async (tx) => {
        const cursor = await tx.doc(FollowUpCursor);
        cursor.revision = 1;
        return tx.createTask(DeliverProactiveFollowUp, {
          conversationId: root.id, triggerRevision: 1, authorName: "Guest", message: "Can someone confirm?",
          recentConversation: "Guest: Can someone confirm?", dueAt: Date.now() + 25,
        }, { ownership: { kind: "conversation" }, background: true });
      }, BACKGROUND_CONTEXT);
      harness.resume();
      expect((await harness.waitForTask(taskId, BACKGROUND_CONTEXT)).state.status).toBe("terminal");
      let view = await root.context(BACKGROUND_CONTEXT);
      expect(view.entries.some((entry) => entry.kind === "chat.follow-up")).toBe(true);
      expect(view.entries.some((entry) => entry.kind === "pi.assistant" && entry.model?.some((message) => message.role === "assistant" && message.content.some((part) => part.type === "text" && part.text === "A gentle check-in.")))).toBe(true);

      const staleTask = await root.commit(async (tx) => {
        const cursor = await tx.doc(FollowUpCursor);
        cursor.revision = 2;
        return tx.createTask(DeliverProactiveFollowUp, {
          conversationId: root.id, triggerRevision: 1, authorName: "Guest", message: "Already resolved",
          recentConversation: "A newer room message arrived.", dueAt: Date.now() + 25,
        }, { ownership: { kind: "conversation" }, background: true });
      }, BACKGROUND_CONTEXT);
      harness.resume();
      expect((await harness.waitForTask(staleTask, BACKGROUND_CONTEXT)).state.status).toBe("terminal");
      view = await root.context(BACKGROUND_CONTEXT);
      expect(view.entries.some((entry) => entry.kind === "chat.follow-up" && (entry.data as { text?: string }).text?.includes("Already resolved"))).toBe(false);
    } finally { await harness.close(BACKGROUND_CONTEXT); }
  });

  it("projects named tool status without exposing tool arguments or output", () => {
    const snapshot = snapshotFromView({
      docs: { "pi.live": {
        run: { taskId: 1, inputs: [1] },
        tools: [{ callId: "tool-call-1", name: "call_mcp_tool", status: "running", output: "private tool output" }],
      } },
      entries: [{
        kind: "pi.assistant",
        model: [{ role: "assistant", content: [{
          type: "toolCall", id: "tool-call-1", name: "call_mcp_tool", arguments: { serverId: "docs-server", serverName: "Public docs", toolName: "search", args: { query: "secret query" } },
        }] }],
      }],
    } as never);
    expect(snapshot.progress.phase).toBe("using-tools");
    expect(snapshot.progress.tools).toEqual([{ id: "tool-call-1", name: "Public docs · search", status: "running" }]);
    expect(snapshot.progress.partialText).toBe("");
  });

  it("publishes streamed partial answers in durable conversation snapshots", async () => {
    const chunks = [
      { choices: [{ index: 0, delta: { role: "assistant" } }] },
      { choices: [{ index: 0, delta: { content: "Live " } }] },
      { choices: [{ index: 0, delta: { content: "progress." } }] },
      { choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 2 } },
    ];
    const run = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        for (const item of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`));
          await new Promise((resolve) => setTimeout(resolve, 140));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }), { headers: { "content-type": "text/event-stream" } }));
    const harness = await Harness.open(new MemoryStorage(), options(fakeEnv(run)), BACKGROUND_CONTEXT);
    try {
      const conversation = await harness.root(BACKGROUND_CONTEXT);
      const watch = await conversation.watch(BACKGROUND_CONTEXT);
      const partials: string[] = [];
      watch.start(async (view) => {
        const snapshot = snapshotFromView(view);
        if (snapshot.progress.partialText) partials.push(snapshot.progress.partialText);
      });
      harness.resume();
      const submission = await conversation.submit({ type: "input", content: "Guest: Show progress" }, BACKGROUND_CONTEXT);
      expect((await submission.wait(BACKGROUND_CONTEXT)).status).toBe("done");
      await watch.stop();
      expect(partials.some((text) => text.includes("Live"))).toBe(true);
      expect(partials.some((text) => text.includes("progress."))).toBe(true);
    } finally { await harness.close(BACKGROUND_CONTEXT); }
  });
});
