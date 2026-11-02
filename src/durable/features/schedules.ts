// Calendar/schedule records. These are stored reminders visible to the app; this
// starter does not execute scheduled tasks automatically.
import type { DurableFeatureContext } from "../feature-context";
import type { Schedule } from "../../protocol/chat";
import { now, safeText } from "../validation";

// Lists only schedules in rooms the member belongs to, so private room metadata
// does not leak across workspaces.
export async function listSchedules(ctx: DurableFeatureContext, input: { actorId: string; from?: number; to?: number }): Promise<Schedule[]> {
  await ctx.requireMember(input.actorId);
  const from = Number.isFinite(input.from) ? input.from as number : 0;
  const to = Number.isFinite(input.to) ? input.to as number : Number.MAX_SAFE_INTEGER;
  return ctx.state.storage.sql
    .exec<{ id: string; workspace_id: string; workspace_title: string; instruction: string; run_at: number; created_by: string; created_at: number }>(
      `SELECT s.id, s.workspace_id, w.title AS workspace_title, s.instruction, s.run_at, s.created_by, s.created_at
       FROM schedules s
       JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
       JOIN workspaces w ON w.id = s.workspace_id
       WHERE wm.member_id = ? AND s.run_at >= ? AND s.run_at <= ?
       ORDER BY s.run_at ASC LIMIT 500`,
      input.actorId,
      from,
      to,
    )
    .toArray()
    .map((row) => ({ id: row.id, workspaceId: row.workspace_id, workspaceTitle: row.workspace_title, instruction: row.instruction, runAt: row.run_at, createdBy: row.created_by, createdAt: row.created_at }));
}

export async function createSchedule(ctx: DurableFeatureContext, input: { actorId: string; workspaceId: string; instruction: string; runAt: number }): Promise<Schedule> {
  const actor = await ctx.requireWorkspaceMember(input.actorId, input.workspaceId);
  const instruction = safeText(input.instruction, "Schedule instruction", 1000);
  if (!Number.isFinite(input.runAt) || input.runAt <= now() - 60_000) throw new Error("Schedule time must be in the future");
  const createdAt = now();
  const id = crypto.randomUUID();
  ctx.state.storage.sql.exec(
    "INSERT INTO schedules (id, workspace_id, instruction, run_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    input.workspaceId,
    instruction,
    input.runAt,
    actor.id,
    createdAt,
  );
  const workspace = ctx.state.storage.sql.exec<{ title: string }>("SELECT title FROM workspaces WHERE id = ?", input.workspaceId).toArray()[0];
  return { id, workspaceId: input.workspaceId, workspaceTitle: workspace?.title, instruction, runAt: input.runAt, createdBy: actor.id, createdAt };
}

// A missing schedule is treated as a harmless false result; permission errors are
// still explicit when the schedule exists but the member is not an owner/admin.
export async function deleteSchedule(ctx: DurableFeatureContext, input: { actorId: string; scheduleId: string }): Promise<boolean> {
  await ctx.requireMember(input.actorId);
  const row = ctx.state.storage.sql
    .exec<{ workspace_id: string }>("SELECT workspace_id FROM schedules WHERE id = ?", input.scheduleId)
    .toArray()[0];
  if (row === undefined) return false;
  const actor = await ctx.requireWorkspaceMember(input.actorId, row.workspace_id);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can remove schedules");
  ctx.state.storage.sql.exec("DELETE FROM schedules WHERE id = ?", input.scheduleId);
  return true;
}
