import type { Context } from "@earendil-works/chord";
import { Type } from "@earendil-works/pi-ai";
import { defineDoc, defineTool, type ToolExecutionApi, type ToolRegistration } from "@earendil-works/pi-durable";
import type { Schedule } from "../protocol/chat";
import { RoomPromptContext } from "./room-context";
import { DeliverScheduledInstruction } from "./schedule-task";

export type ScheduleToolOperations = {
  list(): Promise<readonly Schedule[]>;
  cancel(scheduleId: string): Promise<boolean>;
};

const ScheduleIntent = defineDoc<{ schedule?: Schedule }>({
  kind: "app.schedule-intent",
  version: 1,
  scope: "task",
  initial: () => ({}),
});

const scheduleOutput = (text: string) => ({ output: [{ type: "text" as const, text }] });

/** Pi Durable model tools; tool execution, validation, history, and diagnostics stay in the Harness. */
export function createScheduleTools(operations: ScheduleToolOperations): ToolRegistration[] {
  const createSchedule = defineTool({
    name: "schedule",
    description: "Schedule a self-contained reminder or task to be delivered to this room later. Provide a delay in seconds or an absolute Unix timestamp in milliseconds.",
    parameters: Type.Object({
      instruction: Type.String({ minLength: 1, maxLength: 1000, description: "What to do at the scheduled time, without timing words." }),
      delaySeconds: Type.Optional(Type.Integer({ minimum: 1, maximum: 31_622_400, description: "Seconds from now; use for relative requests." })),
      runAt: Type.Optional(Type.Integer({ description: "Absolute Unix timestamp in milliseconds; use instead of delaySeconds." })),
    }),
    replay: "safe",
    execute: async (args, api: ToolExecutionApi, context: Context) => {
      if ((args.delaySeconds === undefined) === (args.runAt === undefined)) {
        return { ...scheduleOutput("Provide exactly one of delaySeconds or runAt."), isError: true };
      }
      const now = Date.now();
      const runAt = args.runAt ?? now + args.delaySeconds! * 1000;
      if (!Number.isSafeInteger(runAt) || runAt <= now || runAt > now + 366 * 24 * 60 * 60 * 1000) {
        return { ...scheduleOutput("The scheduled time must be within the next year."), isError: true };
      }
      const instruction = args.instruction.trim();
      if (!instruction) return { ...scheduleOutput("instruction must contain text."), isError: true };

      const room = await api.snapshot(RoomPromptContext, context);
      if (!room?.workspaceId) return { ...scheduleOutput("The current room context is not ready, so I cannot schedule this reminder."), isError: true };
      const existing = (await api.snapshot(ScheduleIntent, api.taskId, context))?.schedule;
      if (existing !== undefined) {
        return scheduleOutput(`Scheduled reminder ${existing.id} for ${new Date(existing.runAt).toISOString()}: ${existing.instruction}`);
      }
      const schedule = await api.commit(async (tx) => {
        const intent = await tx.doc(ScheduleIntent, api.taskId);
        if (intent.schedule !== undefined) return intent.schedule;
        const taskId = await tx.createTask(DeliverScheduledInstruction, {
          workspaceId: room.workspaceId,
          workspaceTitle: room.workspaceTitle,
          conversationId: api.conversationId,
          instruction,
          runAt,
          createdBy: room.actorId || "agent",
          createdAt: now,
        }, { ownership: { kind: "conversation" }, background: true });
        intent.schedule = { id: String(taskId), workspaceId: room.workspaceId, workspaceTitle: room.workspaceTitle, instruction, runAt, createdBy: room.actorId || "agent", createdAt: now };
        return intent.schedule;
      }, context);
      return scheduleOutput(`Scheduled reminder ${schedule.id} for ${new Date(schedule.runAt).toISOString()}: ${schedule.instruction}`);
    },
  });

  const listSchedules = defineTool({
    name: "list_schedules",
    description: "List upcoming reminders scheduled for this room.",
    parameters: Type.Object({}),
    replay: "safe",
    execute: async (_args, _api, _context) => {
      const schedules = await operations.list();
      if (schedules.length === 0) return scheduleOutput("There are no upcoming reminders in this room.");
      return scheduleOutput(schedules.map((item) => `${item.id}: ${new Date(item.runAt).toISOString()} — ${item.instruction}`).join("\n"));
    },
  });

  const cancelSchedule = defineTool({
    name: "cancel_schedule",
    description: "Cancel an upcoming reminder in this room by its ID.",
    parameters: Type.Object({ scheduleId: Type.String({ minLength: 1 }) }),
    replay: "safe",
    execute: async (args) => {
      const cancelled = await operations.cancel(args.scheduleId);
      return scheduleOutput(cancelled ? `Cancelled reminder ${args.scheduleId}.` : `No active reminder found with ID ${args.scheduleId}.`);
    },
  });
  return [createSchedule, listSchedules, cancelSchedule];
}
