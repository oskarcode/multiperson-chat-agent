import type { AppContext } from "./context";

export const publicOrigin = (request: Request): string => new URL(request.url).origin;

export const requestJson = async (c: AppContext): Promise<Record<string, unknown>> => {
  const text = await c.req.text();
  if (text.trim().length === 0) return {};
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
};

export const textField = (body: Record<string, unknown>, key: string): string => {
  const value = body[key];
  if (typeof value !== "string") throw new Error(`${key} is required`);
  return value;
};

export const optionalTextField = (body: Record<string, unknown>, key: string): string | null => {
  const value = body[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

export const optionalNumberParam = (value: string | null, fallback: number): number => {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
