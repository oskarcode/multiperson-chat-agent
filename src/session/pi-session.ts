import { DurableObject } from "cloudflare:workers";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, type HarnessInspection, type TaskId } from "@earendil-works/pi-durable";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import type { Env } from "../platform-env";
import type { Schedule } from "../protocol/chat";
import { createStarterHarnessOptions } from "./harness";
import { DeliverScheduledInstruction, scheduleFromTask } from "./schedule-task";

type PiSessionStatus = {
  readonly ok: true;
  readonly rootConversationId: number;
  readonly liveTasks: number;
  readonly queuedSubmissions: number;
};

// First Pi Durable-backed Durable Object in the starter. It is intentionally
// small: opening the Harness and root conversation gives us a safe migration
// point before moving the public chat routes from custom message rows to Pi
// Durable entries, tools, tasks, and schedule handling.
export class PiSession extends DurableObject<Env> {
  readonly #ready: Promise<Harness>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#ready = ctx.blockConcurrencyWhile(() => this.#openHarness());
  }

  async status(): Promise<PiSessionStatus> {
    const harness = await this.#ready;
    const root = await harness.root(BACKGROUND_CONTEXT);
    const inspection: HarnessInspection = await harness.inspect(BACKGROUND_CONTEXT);
    return {
      ok: true,
      rootConversationId: root.id,
      liveTasks: inspection.tasks.length,
      queuedSubmissions: inspection.submissions.length,
    };
  }

  async listSchedules(input: { workspaces: readonly { id: string; title?: string }[]; from?: number; to?: number }): Promise<Schedule[]> {
    const workspaceTitles = new Map(input.workspaces.map((workspace) => [workspace.id, workspace.title]));
    const from = Number.isFinite(input.from) ? input.from as number : 0;
    const to = Number.isFinite(input.to) ? input.to as number : Number.MAX_SAFE_INTEGER;
    const inspection = await (await this.#ready).inspect(BACKGROUND_CONTEXT);
    return inspection.tasks
      .map(scheduleFromTask)
      .filter((schedule): schedule is Schedule => schedule !== null)
      .filter((schedule) => workspaceTitles.has(schedule.workspaceId) && schedule.runAt >= from && schedule.runAt <= to)
      .map((schedule) => ({ ...schedule, workspaceTitle: schedule.workspaceTitle ?? workspaceTitles.get(schedule.workspaceId) }))
      .sort((left, right) => left.runAt - right.runAt);
  }

  async createSchedule(input: { actorId: string; workspaceId: string; workspaceTitle?: string; instruction: string; runAt: number }): Promise<Schedule> {
    const harness = await this.#ready;
    const root = await harness.root(BACKGROUND_CONTEXT);
    const createdAt = Date.now();
    if (!Number.isFinite(input.runAt) || input.runAt <= createdAt - 60_000) throw new Error("Schedule time must be in the future");
    const taskId = await root.commit((tx) => tx.createTask(DeliverScheduledInstruction, {
      workspaceId: input.workspaceId,
      ...(input.workspaceTitle === undefined ? {} : { workspaceTitle: input.workspaceTitle }),
      instruction: input.instruction.trim(),
      runAt: input.runAt,
      createdBy: input.actorId,
      createdAt,
    }, { ownership: { kind: "conversation" }, background: true }), BACKGROUND_CONTEXT);
    harness.resume();
    return { id: String(taskId), workspaceId: input.workspaceId, workspaceTitle: input.workspaceTitle, instruction: input.instruction.trim(), runAt: input.runAt, createdBy: input.actorId, createdAt };
  }

  async deleteSchedule(input: { scheduleId: string }): Promise<boolean> {
    const result = await (await this.#ready).abortTask(input.scheduleId as unknown as TaskId, BACKGROUND_CONTEXT);
    return result === "marked";
  }

  async alarm(): Promise<void> {
    const harness = await this.#ready;
    harness.resume();
  }

  async #openHarness(): Promise<Harness> {
    const storage = await openDurableObjectSqliteStorage(this.ctx.storage);
    return Harness.open(storage, createStarterHarnessOptions(), BACKGROUND_CONTEXT);
  }
}
