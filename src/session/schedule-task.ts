import { defineTask, type ConversationId } from "@earendil-works/pi-durable";

export type PiScheduledInstruction = {
  readonly conversationId: ConversationId;
  readonly instruction: string;
  readonly runAt: number;
  readonly createdAt: number;
};

type ScheduleTaskState = { phase: "wait" } | { phase: "deliver" };

/** Pi Durable owns the wait, recovery, conversation submission, and task outcome. */
export const DeliverScheduledInstruction = defineTask<PiScheduledInstruction, ScheduleTaskState, null>({
  name: "app.deliver-scheduled-instruction",
  version: 1,
  initial: () => ({ phase: "wait" }),
  phases: {
    wait: async (task, runtime, context) => {
      await runtime.sleep(task.input.runAt, context);
      await runtime.commit(() => ({ status: "running", checkpoint: { phase: "deliver" } }), context);
    },
    deliver: async (task, runtime, context) => {
      const conversation = await runtime.conversation(task.input.conversationId, context);
      if (conversation === undefined) throw new Error(`Conversation ${task.input.conversationId} no longer exists`);
      const submission = await conversation.submit({
        type: "input",
        content: `Scheduled reminder: ${task.input.instruction}`,
        entry: { kind: "chat.reminder", data: { instruction: task.input.instruction, createdAt: Date.now() } },
        requestId: `scheduled:${runtime.taskId}`,
        whenBusy: "followUp",
      }, context);
      const settled = await submission.wait(context);
      if (settled.status !== "done") throw new Error(`Scheduled reminder ended ${settled.status}`);
      await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: null } }), context);
    },
  },
  abort: async (_task, runtime, context) => {
    await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context);
  },
});
