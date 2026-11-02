import { Hono } from "hono";
import { isAdmin, type AppBindings } from "../context";
import { optionalTextField, requestJson, textField } from "../input";
import { requireAuth } from "../session";

export const skillRoutes = new Hono<AppBindings>();

skillRoutes.use("*", requireAuth);

skillRoutes.get("/", async (c) => c.json({ skills: await c.var.auth.chat.listSkills(c.var.auth.member.id) }));

skillRoutes.post("/", async (c) => {
  const { member, chat } = c.var.auth;
  if (!isAdmin(member)) return c.json({ error: "Only owners and admins can create skills" }, 403);
  const body = await requestJson(c);
  return c.json(await chat.createSkill({ actorId: member.id, title: textField(body, "title"), description: textField(body, "description") }), 201);
});

skillRoutes.get("/:skillId/files", async (c) => {
  return c.json({ files: await c.var.auth.chat.listSkillFiles({ actorId: c.var.auth.member.id, skillId: c.req.param("skillId") }) });
});

skillRoutes.put("/:skillId/files", async (c) => {
  const body = await requestJson(c);
  return c.json(await c.var.auth.chat.updateSkillFile({
    actorId: c.var.auth.member.id,
    skillId: c.req.param("skillId"),
    path: optionalTextField(body, "path") || "SKILL.md",
    content: textField(body, "content"),
  }));
});

skillRoutes.post("/:skillId/enabled", async (c) => {
  const body = await requestJson(c);
  return c.json(await c.var.auth.chat.setSkillEnabled({ actorId: c.var.auth.member.id, skillId: c.req.param("skillId"), enabled: body.enabled !== false }));
});
