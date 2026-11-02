import type { Env } from "../platform-env";

export const AI_MODELS = [
  { provider: "workers-ai", id: "@cf/meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B Instruct", description: "Fast default open-weight model on Workers AI." },
  { provider: "workers-ai", id: "@cf/meta/llama-3.1-70b-instruct", label: "Llama 3.1 70B Instruct", description: "Larger open-weight Llama model where available." },
  { provider: "workers-ai", id: "@cf/mistral/mistral-7b-instruct-v0.2", label: "Mistral 7B Instruct", description: "Small efficient open-weight model." },
  { provider: "workers-ai", id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", label: "DeepSeek R1 Distill Qwen 32B", description: "Reasoning-oriented open-weight model where available." },
  { provider: "workers-ai", id: "@cf/moonshotai/kimi-k2.5", label: "Kimi K2.5", description: "Moonshot AI frontier open model on Workers AI; older/deprecated but useful where still enabled." },
  { provider: "workers-ai", id: "@cf/moonshotai/kimi-k2.6", label: "Kimi K2.6", description: "Moonshot AI frontier open model on Workers AI; may require Workers Paid." },
  { provider: "workers-ai", id: "@cf/moonshotai/kimi-k2.7-code", label: "Kimi K2.7 Code", description: "Moonshot AI agentic coding model on Workers AI; may require Workers Paid." },
  { provider: "workers-ai", id: "@cf/zai-org/glm-4.7-flash", label: "GLM-4.7 Flash", description: "Fast multilingual Z.ai model with long context." },
  { provider: "workers-ai", id: "@cf/zai-org/glm-5.2", label: "GLM-5.2", description: "Z.ai flagship agentic model on Workers AI; may require Workers Paid." },
  { provider: "workers-ai", id: "@cf/zai-org/glm-5.3-flash", label: "GLM-5.3 Flash", description: "Fast Z.ai GLM-5 generation where available." },
  { provider: "workers-ai", id: "@cf/zai-org/glm-5.3", label: "GLM-5.3", description: "Larger Z.ai GLM-5 generation where available." },
  { provider: "anthropic", id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", description: "Bring your own Anthropic API key." },
  { provider: "anthropic", id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", description: "Bring your own Anthropic API key." },
] as const;

export const defaultAiModel = (env: Env): string => env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";
