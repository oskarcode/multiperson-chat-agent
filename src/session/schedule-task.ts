import { defineTask, type ConversationId, type TaskInspection } from "@earendil-works/pi-durable";

export type PiScheduledInstruction = {
  readonly workspaceId: string;
  readonly workspaceTitle?: string;
  readonly conversationId: ConversationId;
  readonly instruction: string;
  readonly runAt: number;
  readonly createdBy: string;
  readonly createdAt: number;
};

type ScheduleTaskState = { phase: "wait" } | { phase: "deliver" };

/** Pi Durable owns the wait, recovery, conversation submission, and task outcome. */
export const DeliverScheduledInstruction = defineTask<PiScheduledInstruction, ScheduleTaskState, null>({
  name: "app.deliver-scheduled-instruction",
  version: 2,
  initial: () => ({ phase: "wait" }),
  migrate: (input, _checkpoint, _fromVersion) => ({
    input: {
      ...(input as PiScheduledInstruction),
      conversationId: ((input as Partial<PiScheduledInstruction>).conversationId ?? 1) as ConversationId,
    },
    checkpoint: { phase: "wait" },
  }),
  phases: {
    wait: async (task, runtime, context) => {
      await runtime.sleep(task.input.runAt, context);
      await runtime.commit(() => ({ status: "running", checkpoint: { phase: "deliver" } }), context);
    },
    deliver: async (task, runtime, context) => {
      const conversation = await runtime.conversation(task.input.conversationId as ConversationId, context);
      if (conversation === undefined) {
        throw new Error(`Scheduled conversation ${task.input.conversationId} no longer exists`);
      }
      const submission = await conversation.submit({
        type: "input",
        content: `Scheduled reminder: ${task.input.instruction}`,
        requestId: `scheduled:${runtime.taskId}`,
        whenBusy: "followUp",
      }, context);
      await submission.wait(context);
      await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: null } }), context);
    },
  },
  abort: async (_task, runtime, context) => {
    await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context);
  },
});

/** Convert live Pi Durable task inspection records to the Calendar API shape. */
export const scheduleFromTask = (task: TaskInspection) => {
  if (task.record.kind !== DeliverScheduledInstruction.definition.name || task.state.kind === "blocked") return null;
  const input = task.record.input as Partial<PiScheduledInstruction>;
  if (
    typeof input.workspaceId !== "string" ||
    typeof input.conversationId !== "number" ||
    typeof input.instruction !== "string" ||
    typeof input.runAt !== "number" ||
    typeof input.createdBy !== "string" ||
    typeof input.createdAt !== "number"
  ) return null;
  return {
    id: String(task.record.id),
    workspaceId: input.workspaceId,
    ...(typeof input.workspaceTitle === "string" ? { workspaceTitle: input.workspaceTitle } : {}),
    instruction: input.instruction,
    runAt: input.runAt,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  };
};
