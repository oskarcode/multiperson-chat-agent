import { defineTask, type TaskInspection } from "@earendil-works/pi-durable";

export type PiScheduledInstruction = {
  readonly workspaceId: string;
  readonly workspaceTitle?: string;
  readonly instruction: string;
  readonly runAt: number;
  readonly createdBy: string;
  readonly createdAt: number;
};

type ScheduleTaskState = { phase: "wait" };

// Minimal Pi Durable-backed schedule task. It keeps the schedule as a live task
// until runAt, so the Calendar can list active work from Harness inspection.
// Delivery into the conversation will be added when chat traffic moves onto the
// Pi Durable session; this avoids a second custom scheduler in the meantime.
export const DeliverScheduledInstruction = defineTask<PiScheduledInstruction, ScheduleTaskState, null>({
  name: "app.deliver-scheduled-instruction",
  version: 1,
  initial: () => ({ phase: "wait" }),
  phases: {
    wait: async (task, runtime, context) => {
      await runtime.sleep(task.input.runAt, context);
      await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: null } }), context);
    },
  },
  abort: async (_task, runtime, context) => {
    await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context);
  },
});

export const scheduleFromTask = (task: TaskInspection) => {
  if (task.record.kind !== DeliverScheduledInstruction.definition.name) return null;
  const input = task.record.input as Partial<PiScheduledInstruction>;
  if (
    typeof input.workspaceId !== "string" ||
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
