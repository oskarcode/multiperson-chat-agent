import { Hono } from "hono";
import type { Role } from "../../protocol/chat";
import { isAdmin, type AppBindings } from "../context";
import { optionalTextField, publicOrigin, requestJson, textField } from "../input";
import { requireAuth } from "../session";

export const inviteRoutes = new Hono<AppBindings>();

inviteRoutes.use("*", requireAuth);

inviteRoutes.post("/accept", async (c) => {
  const body = await requestJson(c);
  return c.json(await c.var.auth.chat.acceptInvite({ actorId: c.var.auth.member.id, code: textField(body, "code") }));
});

inviteRoutes.get("/", async (c) => {
  const workspaceId = c.req.query("workspaceId") ?? "";
  return c.json({ invites: await c.var.auth.chat.listInvites({ actorId: c.var.auth.member.id, workspaceId }) });
});

inviteRoutes.post("/", async (c) => {
  const { member, chat } = c.var.auth;
  if (!isAdmin(member)) return c.json({ error: "Only owners and admins can invite members" }, 403);
  const body = await requestJson(c);
  const role: Role = optionalTextField(body, "role") === "admin" ? "admin" : "member";
  const workspaceId = textField(body, "workspaceId");
  const invite = await chat.createInvite({ actorId: member.id, workspaceId, role });
  return c.json({ ...invite, url: `${publicOrigin(c.req.raw)}/?invite=${encodeURIComponent(invite.code)}&workspace=${encodeURIComponent(invite.workspaceId)}` }, 201);
});

inviteRoutes.delete("/:code", async (c) => {
  await c.var.auth.chat.revokeInvite({ actorId: c.var.auth.member.id, code: c.req.param("code") });
  return c.json({ ok: true });
});
