import { Hono } from "hono";
import { isAdmin, type AppBindings } from "../context";
import { publicOrigin, requestJson, textField } from "../input";
import { requireAuth } from "../session";

export const connectorRoutes = new Hono<AppBindings>();

connectorRoutes.use("*", requireAuth);

connectorRoutes.get("/", async (c) => c.json({ connectors: await c.var.auth.chat.listConnectors(c.var.auth.member.id) }));

connectorRoutes.post("/", async (c) => {
  const { member, chat } = c.var.auth;
  if (!isAdmin(member)) return c.json({ error: "Only owners and admins can add connectors" }, 403);
  const body = await requestJson(c);
  return c.json(await chat.addConnector({ actorId: member.id, label: textField(body, "label"), url: textField(body, "url"), publicOrigin: publicOrigin(c.req.raw) }), 201);
});

connectorRoutes.post("/:connectorId/refresh", async (c) => {
  const { member, chat } = c.var.auth;
  if (!isAdmin(member)) return c.json({ error: "Only owners and admins can refresh connectors" }, 403);
  return c.json(await chat.refreshConnector({ actorId: member.id, connectorId: c.req.param("connectorId"), publicOrigin: publicOrigin(c.req.raw) }));
});

connectorRoutes.post("/:connectorId/tools/:toolName/call", async (c) => {
  const { member, chat } = c.var.auth;
  if (!isAdmin(member)) return c.json({ error: "Only owners and admins can call connector tools in this MVP" }, 403);
  const body = await requestJson(c);
  const args = typeof body.args === "object" && body.args !== null && !Array.isArray(body.args) ? body.args as Record<string, unknown> : {};
  return c.json(await chat.callConnectorTool({
    actorId: member.id,
    connectorId: c.req.param("connectorId"),
    toolName: c.req.param("toolName"),
    publicOrigin: publicOrigin(c.req.raw),
    args,
  }));
});
