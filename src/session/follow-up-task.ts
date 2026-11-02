import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { defineDoc, defineTask, type ConversationId } from "@earendil-works/pi-durable";

export type ProactiveFollowUpInput = {
  readonly workspaceId: string;
  readonly conversationId: ConversationId;
  readonly triggerRevision: number;
  readonly authorId: string;
  readonly authorName: string;
  readonly message: string;
  readonly recentConversation: string;
  readonly dueAt: number;
  readonly requestKey?: string;
};

type FollowUpTaskState = { phase: "wait" } | { phase: "deliver"; attempt: number } | { phase: "retry"; attempt: number; retryAt: number };
type FollowUpTaskOutcome = null;

/** Pi Durable session cursor used to resolve stale follow-ups before delivery. */
export const FollowUpCursor = defineDoc<{ revision: number }>({
  kind: "app.proactive-follow-up-cursor",
  version: 1,
  scope: "session",
  initial: () => ({ revision: 0 }),
});

/** Waits durably, then delivers the proactive nudge through the room conversation. */
export const DeliverProactiveFollowUp = defineTask<ProactiveFollowUpInput, FollowUpTaskState, FollowUpTaskOutcome>({
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
      if (conversation === undefined) throw new Error(`Follow-up conversation ${task.input.conversationId} no longer exists`);
      try {
        const submission = await conversation.submit({
          type: "input",
          requestId: `${task.input.requestKey ?? `follow-up:${task.input.workspaceId}:${task.input.triggerRevision}`}:attempt-${task.state.checkpoint.attempt}`,
          whenBusy: "followUp",
          content: [
            "[Group Agent proactive follow-up]",
            `The latest unresolved turn from ${task.input.authorName} has not received a visible response for 30 minutes: ${JSON.stringify(task.input.message)}.`,
            "Write one useful, concise follow-up. Ask for the missing answer, check whether help is still needed, or suggest the simplest next decision. Do not mention automation or timers.",
            "Recent room conversation:",
            task.input.recentConversation,
          ].join("\n\n"),
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
