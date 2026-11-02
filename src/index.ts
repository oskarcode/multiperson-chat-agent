import { DemoAdmin } from "./admin/demo-admin";
import { ChatRoom } from "./session/chat-room";
import { validatePublicMcpUrl, listMcpTools } from "./integrations/mcp";
import { adminHtml } from "./ui/admin-html";
import { appHtml } from "./ui/app-html";
import type { Env } from "./platform-env";

export { ChatRoom, DemoAdmin };

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
      let mcp = { url: mcpUrl, configured: Boolean(mcpUrl), tools: [] as Awaited<ReturnType<typeof listMcpTools>>, error: undefined as string | undefined };
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

async function fetchRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
    return new Response(request.method === "HEAD" ? null : appHtml, { headers: pageHeaders });
  }
  if (url.pathname === "/admin" && request.method === "GET") return new Response(adminHtml, { headers: pageHeaders });
  if (/^\/w\/[^/]+$/u.test(url.pathname) && request.method === "GET") {
    let id: string;
    try { id = roomId(url.pathname.slice(3)); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid workspace ID." }, 400); }
    if (!(await env.ADMIN.getByName("global").getWorkspaceInfo(id))) return json({ error: "Workspace not found." }, 404);
    return new Response(appHtml, { headers: { ...pageHeaders, "X-Robots-Tag": "noindex, nofollow" } });
  }
  if (url.pathname.startsWith("/api/admin/")) return adminApi(request, env, url);

  const workspaceMatch = /^\/api\/workspaces\/([^/]+)\/(messages|events|mcp|info)$/u.exec(url.pathname);
  const legacyRoomMatch = /^\/api\/rooms\/([^/]+)\/(messages|events|mcp)$/u.exec(url.pathname);
  const match = workspaceMatch ?? legacyRoomMatch;
  if (!match) return json({ error: "Not found" }, 404);

  let id: string;
  try { id = roomId(match[1]); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid workspace ID." }, 400); }
  if (workspaceMatch && !(await env.ADMIN.getByName("global").getWorkspaceInfo(id))) return json({ error: "Workspace not found." }, 404);
  const workspace = env.ROOMS.getByName(id);

  try {
    if (match[2] === "info" && request.method === "GET") return json({ workspace: await workspace.getWorkspace() });
    if (match[2] === "messages" && request.method === "GET") return json({ messages: await workspace.getMessages() });
    if (match[2] === "events" && request.method === "GET") {
      const stream = await workspace.watch();
      return new Response(stream, { headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      } });
    }
    if (match[2] === "mcp" && request.method === "GET") return json(await workspace.mcpStatus());
    if (match[2] === "messages" && request.method === "POST") {
      const body = await bodyObject(request);
      const authorName = textField(body, "authorName", 80);
      const text = textField(body, "text", 4000);
      if (body.target === "agent") {
        const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
        if (requestId.length > 120) return json({ error: "requestId must be 120 characters or fewer." }, 400);
        const result = await workspace.askAgent({ authorName, text, requestId: requestId || crypto.randomUUID() });
        return json(result, 202);
      }
      return json({ message: await workspace.sendGroupMessage({ authorName, text }) }, 201);
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error(JSON.stringify({ message: "Workspace request failed", workspaceId: id, path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
    return json({ error: error instanceof Error ? error.message : "Request failed" }, 400);
  }
}

export default {
  fetch: fetchRequest,
} satisfies ExportedHandler<Env>;
