// Shared Durable Object validation and limits. Keep this file deterministic:
// storage, network calls, and Cloudflare bindings belong in feature modules.
import type { Role } from "../protocol/chat";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const FOLLOW_UP_DELAY_MS = 30 * 60 * 1000;
export const FOLLOW_UP_RECOVERY_DELAY_MS = 60 * 1000;
export const MAX_MESSAGE_LENGTH = 8000;

export const now = (): number => Date.now();

// Fast local classifier used before spending a Workers AI call on follow-up
// detection. It intentionally favors obvious open questions and requests.
export const hasExplicitOpenQuestion = (message: string): boolean =>
  /\?/u.test(message) ||
  /\b(?:can|could|would|will|should|do|does|did|is|are|was|were|what|when|where|which|who|why|how)\s+(?:you|we|someone|anyone|the group)\b|\b(?:please|let me know|any thoughts|what do you think|follow up|remind us|check back)\b/iu.test(message);

// Workers AI and OpenAI-style providers return text in slightly different JSON
// shapes. This helper extracts the first useful text without depending on one provider.
export const aiText = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["response", "text", "output_text"] as const) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  const result = record.result;
  if (typeof result === "object" && result !== null) return aiText(result);
  const choices = record.choices;
  if (Array.isArray(choices)) {
    const parts = choices.flatMap((choice) => {
      if (typeof choice !== "object" || choice === null) return [];
      const message = (choice as Record<string, unknown>).message;
      if (typeof message === "object" && message !== null && typeof (message as Record<string, unknown>).content === "string") return [(message as Record<string, string>).content];
      if (typeof (choice as Record<string, unknown>).text === "string") return [(choice as Record<string, string>).text];
      return [];
    }).filter(Boolean);
    if (parts.length > 0) return parts.join("\n").trim();
  }
  return undefined;
};

// Normalizes UI input at the state boundary so feature modules store trimmed,
// bounded strings and produce consistent user-facing validation errors.
export const safeText = (value: string, label: string, max = 200): string => {
  const text = value.trim();
  if (text.length === 0) throw new Error(`${label} is required`);
  if (text.length > max) throw new Error(`${label} is too long`);
  return text;
};

export const validEmail = (value: string): string => {
  const email = safeText(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new Error("Enter a valid email address");
  return email;
};

export const normalizeRole = (role: Role): Role => (role === "owner" || role === "admin" ? role : "member");
