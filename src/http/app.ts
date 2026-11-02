import { Hono } from "hono";
import type { AppBindings } from "./context";
import { aiSettingsRoutes } from "./routes/ai-settings";
import { connectorRoutes } from "./routes/connectors";
import { inviteRoutes } from "./routes/invites";
import { mcpCallbackRoutes } from "./routes/mcp-callback";
import { memberRoutes } from "./routes/members";
import { piDurableRoutes } from "./routes/pi-durable";
import { publicRoutes } from "./routes/public";
import { scheduleRoutes } from "./routes/schedules";
import { skillRoutes } from "./routes/skills";
import { workspaceRoutes } from "./routes/workspaces";
import { appHtml } from "../ui/app-html";

export const createApp = (): Hono<AppBindings> => {
  const app = new Hono<AppBindings>();

  // Keep route mounting explicit so beginners can find the file that owns each API group.
  app.route("/api", publicRoutes);
  app.route("/api/mcp", mcpCallbackRoutes);
  app.route("/api/pi", piDurableRoutes);
  app.route("/api/members", memberRoutes);
  app.route("/api/workspaces", workspaceRoutes);
  app.route("/api/invites", inviteRoutes);
  app.route("/api/ai/settings", aiSettingsRoutes);
  app.route("/api/skills", skillRoutes);
  app.route("/api/schedules", scheduleRoutes);
  app.route("/api/connectors", connectorRoutes);

  app.onError((error, c) => c.json({ error: error instanceof Error ? error.message : "Request failed" }, 400));
  app.notFound((c) => c.req.path.startsWith("/api/") ? c.json({ error: "Not found" }, 404) : c.json({ error: "Method not allowed" }, 405));

  app.get("*", (c) => c.html(appHtml, 200, {
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    "Referrer-Policy": "no-referrer",
  }));
  app.on("HEAD", "*", () => new Response(null, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }));

  return app;
};
