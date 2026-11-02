// AI settings persistence. Safe browser responses never include stored API keys;
// runtime responses are only used server-side when the agent needs to call a provider.
import type { DurableFeatureContext } from "../feature-context";
import type { AiProvider, AiRuntimeSettings, AiSettings } from "../../protocol/chat";
import { now, safeText } from "../validation";

// Browser-facing read: tells the UI whether a key exists without exposing it.
export async function getAiSettings(ctx: DurableFeatureContext, memberId: string): Promise<AiSettings | null> {
  await ctx.requireMember(memberId);
  const runtime = await getAiRuntimeSettings(ctx, memberId);
  if (runtime === null) return null;
  const { apiKey: _apiKey, ...safe } = runtime;
  return { ...safe, apiKeyConfigured: Boolean(runtime.apiKey) };
}

// Server-facing read: includes the API key so src/agent/reply.ts can call the
// configured provider. Do not return this value directly to the browser.
export async function getAiRuntimeSettings(ctx: DurableFeatureContext, memberId: string): Promise<AiRuntimeSettings | null> {
  await ctx.requireMember(memberId);
  const row = ctx.state.storage.sql
    .exec<{ value: string; updated_at: number }>("SELECT value, updated_at FROM settings WHERE key = 'ai' AND value <> ''")
    .toArray()[0];
  if (row === undefined) return null;
  const parsed = JSON.parse(row.value) as AiRuntimeSettings;
  return { ...parsed, updatedAt: row.updated_at, apiKeyConfigured: Boolean(parsed.apiKey) };
}

export async function updateAiSettings(ctx: DurableFeatureContext, input: { actorId: string; provider: AiProvider; model: string; apiKey?: string | null }): Promise<AiSettings> {
  const actor = await ctx.requireMember(input.actorId);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can update AI settings");
  const provider = input.provider === "anthropic" ? "anthropic" : "workers-ai";
  const model = safeText(input.model, "Model", 120);
  const previous = await getAiRuntimeSettings(ctx, input.actorId);
  const apiKey = input.apiKey && input.apiKey.trim().length > 0 ? input.apiKey.trim() : previous?.apiKey;
  const runtime: AiRuntimeSettings = provider === "anthropic"
    ? { provider, model, apiKey, updatedAt: now() }
    : { provider, model, updatedAt: now() };
  ctx.state.storage.sql.exec(
    `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('ai', ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    JSON.stringify(runtime),
    actor.id,
    runtime.updatedAt,
  );
  const { apiKey: _apiKey, ...safe } = runtime;
  return { ...safe, apiKeyConfigured: Boolean(runtime.apiKey) };
}
