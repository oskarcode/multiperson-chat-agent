import { Hono } from "hono";
import { hashPassword } from "../../auth/crypto";
import { chatStub, type AppBindings } from "../context";
import { optionalTextField, requestJson, textField } from "../input";
import { currentAppSession, signedOutCookie, signedSessionCookie } from "../session";

export const publicRoutes = new Hono<AppBindings>();

publicRoutes.get("/me", async (c) => {
  const chat = chatStub(c.env);
  const setup = await chat.setupStatus();
  const current = await currentAppSession(c.req.raw, c.env);
  return c.json({ ok: current !== null, configured: Boolean(c.env.SESSION_SECRET), member: current?.member ?? null, setup });
});

publicRoutes.post("/setup", async (c) => {
  if (!c.env.SESSION_SECRET) return c.json({ error: "SESSION_SECRET must be configured" }, 500);
  const body = await requestJson(c);
  const member = await chatStub(c.env).setupAppOwner({
    groupName: optionalTextField(body, "groupName") || undefined,
    name: textField(body, "name"),
    email: textField(body, "email"),
    passwordHash: await hashPassword(textField(body, "password")),
  });
  return c.json({ member }, 201, { "Set-Cookie": await signedSessionCookie(member.id, c.env.SESSION_SECRET, c.req.raw) });
});

publicRoutes.post("/login", async (c) => {
  if (!c.env.SESSION_SECRET) return c.json({ error: "SESSION_SECRET is not configured" }, 500);
  const body = await requestJson(c);
  const member = await chatStub(c.env).loginAppMember({ email: textField(body, "email"), password: textField(body, "password") });
  return c.json({ member }, 200, { "Set-Cookie": await signedSessionCookie(member.id, c.env.SESSION_SECRET, c.req.raw) });
});

publicRoutes.post("/join", async (c) => {
  if (!c.env.SESSION_SECRET) return c.json({ error: "SESSION_SECRET is not configured" }, 500);
  const body = await requestJson(c);
  const password = optionalTextField(body, "password");
  const member = await chatStub(c.env).joinWithInvite({
    code: textField(body, "code"),
    name: textField(body, "name"),
    email: optionalTextField(body, "email"),
    passwordHash: password === null ? null : await hashPassword(password),
  });
  return c.json({ member }, 201, { "Set-Cookie": await signedSessionCookie(member.id, c.env.SESSION_SECRET, c.req.raw) });
});

publicRoutes.post("/logout", (c) => c.json({ ok: true }, 200, { "Set-Cookie": signedOutCookie() }));
