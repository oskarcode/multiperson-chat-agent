import { Hono } from "hono";
import type { Schedule } from "../../protocol/chat";
import { isAdmin, type AppBindings } from "../context";
import { optionalNumberParam, requestJson, textField } from "../input";
import { requireAuth } from "../session";

export const scheduleRoutes = new Hono<AppBindings>();

type PiSessionRpc = {
  listSchedules(input: { workspaceId: string; workspaceTitle?: string; from?: number; to?: number }): Promise<Schedule[]>;
  createSchedule(input: { actorId: string; workspaceId: string; workspaceTitle?: string; instruction: string; runAt: number }): Promise<Schedule>;
  deleteSchedule(input: { scheduleId: string; workspaceId?: string }): Promise<boolean>;
};

const session = (c: { env: AppBindings["Bindings"] }, workspaceId: string): PiSessionRpc => c.env.SESSIONS.getByName(workspaceId) as unknown as PiSessionRpc;

scheduleRoutes.use("*", requireAuth);

scheduleRoutes.get("/", async (c) => {
  const from = optionalNumberParam(c.req.query("from") ?? null, Date.now() - 24 * 60 * 60 * 1000);
  const to = optionalNumberParam(c.req.query("to") ?? null, Date.now() + 60 * 24 * 60 * 60 * 1000);
  const workspaces = await c.var.auth.chat.listWorkspaces(c.var.auth.member.id);
  const schedules = (await Promise.all(workspaces.map((workspace) =>
    session(c, workspace.id).listSchedules({ workspaceId: workspace.id, workspaceTitle: workspace.title, from, to })
  ))).flat().sort((left, right) => left.runAt - right.runAt);
  return c.json({ schedules });
});

scheduleRoutes.post("/", async (c) => {
  const body = await requestJson(c);
  const workspaceId = textField(body, "workspaceId");
  const workspace = (await c.var.auth.chat.listWorkspaces(c.var.auth.member.id)).find((item) => item.id === workspaceId);
  if (workspace === undefined) return c.json({ error: "Room not found" }, 404);
  return c.json(await session(c, workspaceId).createSchedule({
    actorId: c.var.auth.member.id,
    workspaceId,
    workspaceTitle: workspace.title,
    instruction: textField(body, "instruction"),
    runAt: Number(body.runAt),
  }), 201);
});

scheduleRoutes.delete("/:scheduleId", async (c) => {
  if (!isAdmin(c.var.auth.member)) return c.json({ error: "Only owners and admins can remove schedules" }, 403);
  const workspaces = await c.var.auth.chat.listWorkspaces(c.var.auth.member.id);
  for (const workspace of workspaces) {
    if (await session(c, workspace.id).deleteSchedule({ scheduleId: c.req.param("scheduleId"), workspaceId: workspace.id })) return c.json({ deleted: true });
  }
  return c.json({ deleted: false });
});
