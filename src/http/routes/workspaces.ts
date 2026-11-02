import { Hono } from "hono";
import { generateAgentReply } from "../../agent/reply";
import { parseScheduleRequest, scheduleConfirmation } from "../../agent/schedule-request";
import { isAdmin, type AppBindings } from "../context";
import { optionalTextField, requestJson, textField } from "../input";
import { requireAuth } from "../session";

export const workspaceRoutes = new Hono<AppBindings>();

workspaceRoutes.use("*", requireAuth);

workspaceRoutes.get("/", async (c) => {
  const { member, chat } = c.var.auth;
  return c.json({ workspaces: await chat.listWorkspaces(member.id) });
});

workspaceRoutes.post("/", async (c) => {
  const { member, chat } = c.var.auth;
  if (!isAdmin(member)) return c.json({ error: "Only owners and admins can create rooms" }, 403);
  const body = await requestJson(c);
  return c.json(await chat.createWorkspace({ actorId: member.id, title: textField(body, "title") }), 201);
});

workspaceRoutes.get("/:workspaceId/messages", async (c) => {
  const { member, chat } = c.var.auth;
  return c.json({ messages: await chat.listMessages({ actorId: member.id, workspaceId: c.req.param("workspaceId") }) });
});

workspaceRoutes.post("/:workspaceId/messages", async (c) => {
  const { member, chat } = c.var.auth;
  const workspaceId = c.req.param("workspaceId");
  const body = await requestJson(c);
  const target = optionalTextField(body, "target") === "agent" ? "agent" : "group";
  const message = await chat.appendGroupMessage({
    actorId: member.id,
    workspaceId,
    text: textField(body, "text"),
    kind: target === "agent" ? "agent-request" : "group",
  });
  const messages = [message];
  if (target === "agent") {
    const schedule = parseScheduleRequest(textField(body, "text"));
    if (schedule !== null) {
      await chat.createSchedule({ actorId: member.id, workspaceId, instruction: schedule.instruction, runAt: schedule.runAt });
      messages.push(await chat.appendAgentMessage({ workspaceId, text: scheduleConfirmation(schedule.instruction, schedule.runAt) }));
    } else {
      const reply = await generateAgentReply(c.env, chat, member.id, workspaceId);
      messages.push(await chat.appendAgentMessage({ workspaceId, text: reply }));
    }
  }
  return c.json({ messages }, 201);
});
