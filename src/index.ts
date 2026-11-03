import { Hono } from "hono";
import { DemoAdmin } from "./admin/demo-admin";
import { ChatRoom } from "./session/chat-room";
import { validatePublicMcpUrl, listMcpTools } from "./integrations/mcp";
import { adminHtml } from "./ui/admin-html";
import { appHtml } from "./ui/app-html";
import type { Env } from "./platform-env";

export { ChatRoom, DemoAdmin };

type HonoEnv = { Bindings: Env };

const pageHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function roomId(value: string): string {
  const decoded = decodeURIComponent(value);
  if (!/^[A-Za-z0-9._-]{1,80}$/u.test(decoded)) throw new Error("Workspace IDs may use letters, numbers, dots, underscores, and hyphens.");
  return decoded;
}

async function bodyObject(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Send a JSON object.");
  return value as Record<string, unknown>;
}

function textField(body: Record<string, unknown>, key: string, limit: number): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required.`);
  if (value.trim().length > limit) throw new Error(`${key} must be ${limit} characters or fewer.`);
  return value.trim();
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function adminAuthorized(request: Request, env: Env): boolean {
  const expected = env.ADMIN_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(expected && supplied && constantTimeEqual(supplied, expected));
}

async function adminApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.ADMIN_SECRET) return json({ error: "Admin secret is not configured on this Worker." }, 503);
  if (!adminAuthorized(request, env)) return json({ error: "Admin secret required." }, 401);

  const control = env.ADMIN.getByName("global");
  try {
    if (url.pathname === "/api/admin/state" && request.method === "GET") {
      const [workspaces, mcpUrl] = await Promise.all([control.listWorkspaces(), control.getMcpUrl()]);
      const mcp = { url: mcpUrl, configured: Boolean(mcpUrl), tools: [] as Awaited<ReturnType<typeof listMcpTools>>, error: undefined as string | undefined };
      if (mcpUrl) {
        try { mcp.tools = await listMcpTools(mcpUrl); }
        catch (error) { mcp.error = error instanceof Error ? error.message : String(error); }
      }
      return json({ workspaces, mcp });
    }
    if (url.pathname === "/api/admin/workspaces" && request.method === "GET") {
      return json({ workspaces: await control.listWorkspaces() });
    }
    if (url.pathname === "/api/admin/workspaces" && request.method === "POST") {
      const body = await bodyObject(request);
      const workspace = await control.createWorkspace(textField(body, "title", 80));
      return json({ workspace }, 201);
    }
    const deleteWorkspaceMatch = /^\/api\/admin\/workspaces\/([^/]+)$/u.exec(url.pathname);
    if (deleteWorkspaceMatch && request.method === "DELETE") {
      const id = roomId(deleteWorkspaceMatch[1]);
      try {
        if (!(await control.deleteWorkspace(id))) return json({ error: "Workspace not found." }, 404);
        return json({ deleted: true });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Workspace deletion failed." }, 500);
      }
    }
    if (url.pathname === "/api/admin/mcp" && request.method === "PUT") {
      const body = await bodyObject(request);
      const value = typeof body.url === "string" ? body.url.trim() : "";
      if (!value) {
        await control.setMcpUrl("");
        return json({ url: "", configured: false, tools: [] });
      }
      if (value.length > 2048) return json({ error: "MCP URL must be 2048 characters or fewer." }, 400);
      const mcpUrl = validatePublicMcpUrl(value);
      const tools = await listMcpTools(mcpUrl);
      await control.setMcpUrl(mcpUrl);
      return json({ url: mcpUrl, configured: true, tools });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Admin request failed." }, 400);
  }
}

async function workspaceApi(request: Request, env: Env, rawId: string, action: string): Promise<Response> {
  let id: string;
  try { id = roomId(rawId); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid workspace ID." }, 400); }
  if (!(await env.ADMIN.getByName("global").getWorkspaceInfo(id))) return json({ error: "Workspace not found." }, 404);

  const workspace = env.ROOMS.getByName(id);
  try {
    if (action === "info" && request.method === "GET") return json({ workspace: await workspace.getWorkspace() });
    if (action === "messages" && request.method === "GET") return json({ messages: await workspace.getMessages() });
    if (action === "mcp" && request.method === "GET") return json(await workspace.mcpStatus());
    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error(JSON.stringify({ message: "Workspace request failed", workspaceId: id, path: new URL(request.url).pathname, error: error instanceof Error ? error.message : String(error) }));
    return json({ error: error instanceof Error ? error.message : "Request failed" }, 400);
  }
}

async function workspaceSocket(request: Request, env: Env, rawId: string): Promise<Response> {
  if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected a WebSocket upgrade.", { status: 426, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  let id: string;
  try { id = roomId(rawId); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid workspace ID." }, 400); }
  if (!(await env.ADMIN.getByName("global").getWorkspaceInfo(id))) return json({ error: "Workspace not found." }, 404);
  return env.ROOMS.getByName(id).fetch(request);
}

const app = new Hono<HonoEnv>();

app.on(["GET", "HEAD"], "/", (c) => new Response(c.req.method === "HEAD" ? null : appHtml, { headers: pageHeaders }));
app.get("/admin", () => new Response(adminHtml, { headers: pageHeaders }));
app.get("/w/:id", async (c) => {
  let id: string;
  try { id = roomId(c.req.param("id")); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid workspace ID." }, 400); }
  if (!(await c.env.ADMIN.getByName("global").getWorkspaceInfo(id))) return json({ error: "Workspace not found." }, 404);
  return new Response(appHtml, { headers: { ...pageHeaders, "X-Robots-Tag": "noindex, nofollow" } });
});

app.all("/api/admin/*", (c) => adminApi(c.req.raw, c.env, new URL(c.req.url)));
app.get("/api/workspaces/:id/socket", (c) => workspaceSocket(c.req.raw, c.env, c.req.param("id")));
app.get("/api/rooms/:id/socket", (c) => workspaceSocket(c.req.raw, c.env, c.req.param("id")));
app.all("/api/workspaces/:id/:action", (c) => workspaceApi(c.req.raw, c.env, c.req.param("id"), c.req.param("action")));
app.all("/api/rooms/:id/:action", (c) => workspaceApi(c.req.raw, c.env, c.req.param("id"), c.req.param("action")));
app.notFound(() => json({ error: "Not found" }, 404));
app.onError((error, c) => {
  console.error(JSON.stringify({ message: "Unhandled request failure", path: new URL(c.req.url).pathname, error: error.message }));
  return json({ error: "Request failed" }, 500);
});

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
