import { ChatRoom } from "./session/chat-room";
import { appHtml } from "./ui/app-html";
import type { Env } from "./platform-env";

export { ChatRoom };

const pageHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Referrer-Policy": "no-referrer",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function roomId(value: string): string {
  const decoded = decodeURIComponent(value);
  if (!/^[A-Za-z0-9._-]{1,80}$/u.test(decoded)) throw new Error("Room IDs may use letters, numbers, dots, underscores, and hyphens.");
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
  if (value.length > limit) throw new Error(`${key} must be ${limit} characters or fewer.`);
  return value.trim();
}

async function fetchRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
    return new Response(request.method === "HEAD" ? null : appHtml, { headers: pageHeaders });
  }

  const match = /^\/api\/rooms\/([^/]+)\/(messages|events|mcp)$/u.exec(url.pathname);
  if (!match) return json({ error: "Not found" }, 404);

  let id: string;
  try { id = roomId(match[1]); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid room ID" }, 400); }
  const room = env.ROOMS.getByName(id);

  try {
    if (match[2] === "messages" && request.method === "GET") return json({ messages: await room.getMessages() });
    if (match[2] === "events" && request.method === "GET") {
      const stream = await room.watch();
      return new Response(stream, { headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      } });
    }
    if (match[2] === "mcp" && request.method === "GET") return json(await room.mcpStatus());
    if (match[2] === "messages" && request.method === "POST") {
      const body = await bodyObject(request);
      const authorName = textField(body, "authorName", 80);
      const text = textField(body, "text", 4000);
      if (body.target === "agent") {
        const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
        if (requestId.length > 120) return json({ error: "requestId must be 120 characters or fewer." }, 400);
        const result = await room.askAgent({
          authorName,
          text,
          requestId: requestId || crypto.randomUUID(),
        });
        return json(result, 202);
      }
      return json({ message: await room.sendGroupMessage({ authorName, text }) }, 201);
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error(JSON.stringify({ message: "Room request failed", roomId: id, path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
    return json({ error: error instanceof Error ? error.message : "Request failed" }, 400);
  }
}

export default {
  fetch: fetchRequest,
} satisfies ExportedHandler<Env>;
