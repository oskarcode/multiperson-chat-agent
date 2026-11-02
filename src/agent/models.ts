import type { Env } from "../platform-env";

export const AI_MODELS = [
  { provider: "workers-ai", id: "@cf/zai-org/glm-4.7-flash", label: "GLM-4.7 Flash", description: "Fast multilingual model available through the Pi AI Workers AI provider." },
  { provider: "workers-ai", id: "@cf/zai-org/glm-5.2", label: "GLM-5.2", description: "Z.ai flagship agentic model; may require Workers Paid." },
  { provider: "workers-ai", id: "@cf/zai-org/glm-5.3-flash", label: "GLM-5.3 Flash", description: "Fast Z.ai GLM-5 generation where available." },
  { provider: "workers-ai", id: "@cf/zai-org/glm-5.3", label: "GLM-5.3", description: "Larger Z.ai GLM-5 generation where available." },
  { provider: "workers-ai", id: "@cf/moonshotai/kimi-k2.6", label: "Kimi K2.6", description: "Moonshot AI frontier open model; may require Workers Paid." },
  { provider: "workers-ai", id: "@cf/moonshotai/kimi-k2.7-code", label: "Kimi K2.7 Code", description: "Moonshot AI agentic coding model; may require Workers Paid." },
  { provider: "anthropic", id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Bring your own Anthropic API key." },
  { provider: "anthropic", id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", description: "Bring your own Anthropic API key." },
] as const;

export const DEFAULT_WORKERS_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";
export const defaultAiModel = (env: Env): string => env.AI_MODEL || DEFAULT_WORKERS_AI_MODEL;
