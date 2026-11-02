import { Hono } from "hono";
import type { AppBindings } from "../context";
import { optionalNumberParam, requestJson, textField } from "../input";
import { requireAuth } from "../session";

export const scheduleRoutes = new Hono<AppBindings>();

scheduleRoutes.use("*", requireAuth);

scheduleRoutes.get("/", async (c) => {
  const from = optionalNumberParam(c.req.query("from") ?? null, Date.now() - 24 * 60 * 60 * 1000);
  const to = optionalNumberParam(c.req.query("to") ?? null, Date.now() + 60 * 24 * 60 * 60 * 1000);
  return c.json({ schedules: await c.var.auth.chat.listSchedules({ actorId: c.var.auth.member.id, from, to }) });
});

scheduleRoutes.post("/", async (c) => {
  const body = await requestJson(c);
  return c.json(await c.var.auth.chat.createSchedule({
    actorId: c.var.auth.member.id,
    workspaceId: textField(body, "workspaceId"),
    instruction: textField(body, "instruction"),
    runAt: Number(body.runAt),
  }), 201);
});

scheduleRoutes.delete("/:scheduleId", async (c) => {
  return c.json({ deleted: await c.var.auth.chat.deleteSchedule({ actorId: c.var.auth.member.id, scheduleId: c.req.param("scheduleId") }) });
});
