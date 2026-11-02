import { Hono } from "hono";
import { chatStub, type AppBindings } from "../context";
import { publicOrigin } from "../input";
import { popupResult } from "../popup";

export const mcpCallbackRoutes = new Hono<AppBindings>();

mcpCallbackRoutes.get("/callback", async (c) => {
  const origin = publicOrigin(c.req.raw);
  const connectorId = c.req.query("connector") ?? null;
  if (connectorId === null) return popupResult(origin, false, "MCP callback is missing connector id");
  const result = await chatStub(c.env).completeConnectorOAuth({ connectorId, callbackUrl: c.req.url, publicOrigin: origin });
  return popupResult(origin, result.status === "connected", result.status === "connected" ? "MCP connector authorized." : result.lastError ?? "MCP authorization failed.");
});
