import { clearCookie, sessionCookie, sessionMemberId } from "../auth/session";
import type { Env } from "../platform-env";
import { chatStub, type AppMiddleware, type Authed } from "./context";

// Reads the signed session cookie and verifies that the member still exists in
// Durable Object storage. Missing SESSION_SECRET means the app is not ready to authenticate.
export async function currentAppSession(request: Request, env: Env): Promise<Authed | null> {
  if (!env.SESSION_SECRET) return null;
  const memberId = await sessionMemberId(request, env.SESSION_SECRET);
  if (memberId === null) return null;
  const chat = chatStub(env);
  const member = await chat.getMember(memberId);
  return member === null ? null : { member, chat };
}

export const requireAuth: AppMiddleware = async (c, next) => {
  const current = await currentAppSession(c.req.raw, c.env);
  if (current === null) return c.json({ error: "Sign in required" }, 401);
  c.set("auth", current);
  await next();
};

export const signedSessionCookie = (memberId: string, secret: string, request: Request): Promise<string> =>
  sessionCookie(memberId, secret, request);

export const signedOutCookie = (): string => clearCookie();
