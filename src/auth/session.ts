import { signSession, verifySession } from "./crypto";

const SESSION_COOKIE = "multiperson_chat_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const cookieValue = (request: Request, name: string): string | null => {
  const cookie = request.headers.get("Cookie");
  if (cookie === null) return null;
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return null;
};

export const sessionCookie = async (memberId: string, secret: string, request: Request): Promise<string> => {
  const token = await signSession({ memberId, exp: Date.now() + SESSION_TTL_MS }, secret);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
};

export const clearCookie = (): string => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export const sessionMemberId = async (request: Request, secret: string): Promise<string | null> => {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token === null) return null;
  const payload = await verifySession(token, secret);
  return payload?.memberId ?? null;
};
