import { Hono } from "hono";
import type { AppBindings } from "../context";
import { requireAuth } from "../session";

export const memberRoutes = new Hono<AppBindings>();

memberRoutes.use("*", requireAuth);

memberRoutes.get("/", async (c) => {
  return c.json({ members: await c.var.auth.chat.listMembers() });
});
