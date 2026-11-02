import { Hono } from "hono";
import { buildAgentPromptContext } from "../../agent/context";
import { defaultAiModel } from "../../agent/models";
import type { ChatMessage } from "../../protocol/chat";
import { isAdmin, type AppBindings } from "../context";
import { optionalTextField, requestJson, textField } from "../input";
import { requireAuth } from "../session";

export const workspaceRoutes = new Hono<AppBindings>();

type PiSessionRpc = {
  listAgentMessages(input: { workspaceId: string }): Promise<ChatMessage[]>;
  runAgent(input: {
    actorId: string;
    actorName: string;
    publicOrigin: string;
    workspaceId: string;
    workspaceTitle: string;
    promptContext: string;
    requestId: string;
    userMessage: string;
    provider: "workers-ai" | "anthropic";
    model: string;
    apiKey?: string;
  }): Promise<ChatMessage>;
};

const session = (c: { env: AppBindings["Bindings"] }, workspaceId: string): PiSessionRpc => c.env.SESSIONS.getByName(workspaceId) as unknown as PiSessionRpc;

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
  const workspaceId = c.req.param("workspaceId");
  const stored = await chat.listMessages({ actorId: member.id, workspaceId });
  const agentMessages = await session(c, workspaceId).listAgentMessages({ workspaceId });
  return c.json({ messages: [...stored, ...agentMessages].sort((left, right) => left.createdAt - right.createdAt || left.id - right.id) });
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
  const messages: ChatMessage[] = [message];
  if (target === "agent") {
    const workspace = (await chat.listWorkspaces(member.id)).find((item) => item.id === workspaceId);
    if (workspace === undefined) return c.json({ error: "Room not found" }, 404);
    const settings = await chat.getAiRuntimeSettings(member.id);
    const promptContext = await buildAgentPromptContext(c.env, chat, member.id, workspaceId);
    const reply = await session(c, workspaceId).runAgent({
      actorId: member.id,
      actorName: member.name,
      publicOrigin: new URL(c.req.url).origin,
      workspaceId,
      workspaceTitle: workspace.title,
      promptContext,
      requestId: `agent-request:${message.id}`,
      userMessage: message.text,
      provider: settings?.provider ?? "workers-ai",
      model: settings?.model ?? defaultAiModel(c.env),
      ...(settings?.apiKey === undefined ? {} : { apiKey: settings.apiKey }),
    });
    messages.push(reply);
  }
  return c.json({ messages }, 201);
});
