import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { defineDoc, defineTask, type ConversationId } from "@earendil-works/pi-durable";

export type ProactiveFollowUpInput = {
  readonly conversationId: ConversationId;
  readonly triggerRevision: number;
  readonly authorName: string;
  readonly message: string;
  readonly recentConversation: string;
  readonly dueAt: number;
};

type FollowUpTaskState = { phase: "wait" } | { phase: "deliver"; attempt: number } | { phase: "retry"; attempt: number; retryAt: number };

/** New room messages advance this cursor so old follow-up tasks become stale. */
export const FollowUpCursor = defineDoc<{ revision: number }>({
  kind: "app.follow-up-cursor",
  version: 1,
  scope: "session",
  initial: () => ({ revision: 0 }),
});

/** Waits durably, then asks the same Pi conversation to send one useful check-in. */
export const DeliverProactiveFollowUp = defineTask<ProactiveFollowUpInput, FollowUpTaskState, null>({
  name: "app.deliver-proactive-follow-up",
  version: 1,
  initial: () => ({ phase: "wait" }),
  phases: {
    wait: async (task, runtime, context) => {
      await runtime.sleep(task.input.dueAt, context);
      const cursor = await runtime.snapshot(FollowUpCursor, context);
      if ((cursor?.revision ?? 0) !== task.input.triggerRevision) {
        await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: null } }), context);
        return;
      }
      await runtime.commit(() => ({ status: "running", checkpoint: { phase: "deliver", attempt: 1 } }), context);
    },
    retry: async (task, runtime, context) => {
      await runtime.sleep(task.state.checkpoint.retryAt, context);
      await runtime.commit(() => ({ status: "running", checkpoint: { phase: "deliver", attempt: task.state.checkpoint.attempt } }), context);
    },
    deliver: async (task, runtime, context) => {
      const cursor = await runtime.snapshot(FollowUpCursor, context);
      if ((cursor?.revision ?? 0) !== task.input.triggerRevision) {
        await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: null } }), context);
        return;
      }
      const conversation = await runtime.conversation(task.input.conversationId, context);
      if (!conversation) throw new Error(`Conversation ${task.input.conversationId} no longer exists`);
      try {
        const submission = await conversation.submit({
          type: "input",
          requestId: `follow-up:${task.input.triggerRevision}:attempt-${task.state.checkpoint.attempt}`,
          whenBusy: "followUp",
          content: [
            "[Group Agent proactive follow-up]",
            `The room has been quiet since ${task.input.authorName} said: ${JSON.stringify(task.input.message)}.`,
            "Review the conversation context below. If the important question, request, decision, or blocker is still unresolved, send one brief, kind check-in about it. Do not repeat an issue that has already been answered or closed, and do not mention automation or timers.",
            "Recent room conversation in chronological order:",
            task.input.recentConversation,
          ].join("\n\n"),
          entry: {
            kind: "chat.follow-up",
            data: { authorName: "Group Agent follow-up", text: `Checking back on: ${task.input.message}`, createdAt: Date.now() },
          },
        }, context);
        const settled = await submission.wait(context);
        if (settled.status !== "done") throw new Error(`Pi follow-up turn ended ${settled.status}`);
        await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: null } }), context);
      } catch (error) {
        const attempt = task.state.checkpoint.attempt + 1;
        const retryAt = Date.now() + 60_000;
        console.warn(JSON.stringify({ message: "Pi follow-up turn failed; retry scheduled", taskId: runtime.taskId, attempt, error: error instanceof Error ? error.message : String(error) }));
        await runtime.commit(() => ({ status: "running", checkpoint: { phase: "retry", attempt, retryAt } }), context);
      }
    },
  },
  abort: async (_task, runtime, context) => {
    await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context);
  },
});
