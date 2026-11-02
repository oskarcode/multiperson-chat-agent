import type { Context } from "@earendil-works/chord";
import { Type } from "@earendil-works/pi-ai";
import { defineDoc, defineTool, type ToolExecutionApi, type ToolRegistration } from "@earendil-works/pi-durable";
import type { Schedule } from "../protocol/chat";
import { DeliverScheduledInstruction } from "./schedule-task";

export type ScheduleToolOperations = {
  list(): Promise<readonly Schedule[]>;
  cancel(scheduleId: string): Promise<boolean>;
};

type ScheduleIntentState = { schedule?: Schedule };
const ScheduleIntent = defineDoc<ScheduleIntentState>({
  kind: "app.schedule-intent",
  version: 1,
  scope: "task",
  initial: () => ({}),
});

const output = (text: string) => ({ output: [{ type: "text" as const, text }] });

/** Scheduling tools create and manage Pi Durable tasks in this conversation. */
export function createScheduleTools(operations: ScheduleToolOperations): ToolRegistration[] {
  const schedule = defineTool({
    name: "schedule",
    description: "Schedule a reminder for this room. Provide either delaySeconds or an absolute Unix timestamp in milliseconds.",
    parameters: Type.Object({
      instruction: Type.String({ minLength: 1, maxLength: 1000 }),
      delaySeconds: Type.Optional(Type.Integer({ minimum: 1, maximum: 31_622_400 })),
      runAt: Type.Optional(Type.Integer()),
    }),
    replay: "safe",
    execute: async (args, api: ToolExecutionApi, context: Context) => {
      if ((args.delaySeconds === undefined) === (args.runAt === undefined)) {
        return { ...output("Provide exactly one of delaySeconds or runAt."), isError: true };
      }
      const now = Date.now();
      const runAt = args.runAt ?? now + args.delaySeconds! * 1000;
      if (!Number.isSafeInteger(runAt) || runAt <= now || runAt > now + 366 * 24 * 60 * 60 * 1000) {
        return { ...output("The reminder must be scheduled within the next year."), isError: true };
      }
      const instruction = args.instruction.trim();
      if (!instruction) return { ...output("The reminder needs an instruction."), isError: true };

      const existing = (await api.snapshot(ScheduleIntent, api.taskId, context))?.schedule;
      if (existing) return output(`Scheduled reminder ${existing.id} for ${new Date(existing.runAt).toISOString()}.`);
      const created = await api.commit(async (tx) => {
        const intent = await tx.doc(ScheduleIntent, api.taskId);
        if (intent.schedule) return intent.schedule;
        const taskId = await tx.createTask(DeliverScheduledInstruction, {
          conversationId: api.conversationId,
          instruction,
          runAt,
          createdAt: now,
        }, { ownership: { kind: "conversation" }, background: true });
        intent.schedule = { id: String(taskId), instruction, runAt };
        return intent.schedule;
      }, context);
      return output(`Scheduled reminder ${created.id} for ${new Date(created.runAt).toISOString()}.`);
    },
  });

  const listSchedules = defineTool({
    name: "list_schedules",
    description: "List upcoming reminders for this room.",
    parameters: Type.Object({}),
    replay: "safe",
    execute: async () => {
      const schedules = await operations.list();
      return output(schedules.length
        ? schedules.map((item) => `${item.id}: ${new Date(item.runAt).toISOString()} — ${item.instruction}`).join("\n")
        : "There are no upcoming reminders in this room.");
    },
  });

  const cancelSchedule = defineTool({
    name: "cancel_schedule",
    description: "Cancel an upcoming reminder by its ID.",
    parameters: Type.Object({ scheduleId: Type.String({ minLength: 1 }) }),
    replay: "safe",
    execute: async (args) => output(await operations.cancel(args.scheduleId)
      ? `Cancelled reminder ${args.scheduleId}.`
      : `No active reminder found with ID ${args.scheduleId}.`),
  });

  return [schedule, listSchedules, cancelSchedule];
}
