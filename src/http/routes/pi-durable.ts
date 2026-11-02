import { Hono } from "hono";
import { isAdmin, type AppBindings } from "../context";
import { requireAuth } from "../session";

type PiSessionRpc = {
  status(): Promise<{ ok: true; rootConversationId: number; liveTasks: number; queuedSubmissions: number }>;
};

export const piDurableRoutes = new Hono<AppBindings>();

piDurableRoutes.use("*", requireAuth);

// Temporary migration probe: proves the Pi Durable Session Durable Object opens
// and owns a root conversation before public chat traffic is moved onto it.
piDurableRoutes.get("/status", async (c) => {
  if (!isAdmin(c.var.auth.member)) return c.json({ error: "Only owners and admins can inspect Pi Durable status" }, 403);
  const session = c.env.SESSIONS.getByName("default-room") as unknown as PiSessionRpc;
  return c.json(await session.status());
});
