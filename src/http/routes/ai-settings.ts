import { Hono } from "hono";
import { AI_MODELS, defaultAiModel } from "../../agent/models";
import type { AiProvider } from "../../protocol/chat";
import { isAdmin, type AppBindings } from "../context";
import { optionalTextField, requestJson, textField } from "../input";
import { requireAuth } from "../session";

export const aiSettingsRoutes = new Hono<AppBindings>();

aiSettingsRoutes.use("*", requireAuth);

aiSettingsRoutes.get("/", async (c) => {
  const settings = await c.var.auth.chat.getAiSettings(c.var.auth.member.id);
  return c.json({
    models: AI_MODELS,
    settings: settings ?? { provider: "workers-ai", model: defaultAiModel(c.env), apiKeyConfigured: false },
  });
});

aiSettingsRoutes.post("/", async (c) => {
  const { member, chat } = c.var.auth;
  if (!isAdmin(member)) return c.json({ error: "Only owners and admins can update AI settings" }, 403);
  const body = await requestJson(c);
  const provider = optionalTextField(body, "provider") === "anthropic" ? "anthropic" : "workers-ai";
  const settings = await chat.updateAiSettings({
    actorId: member.id,
    provider: provider as AiProvider,
    model: textField(body, "model"),
    apiKey: optionalTextField(body, "apiKey"),
  });
  return c.json({ settings });
});
