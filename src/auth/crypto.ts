// Cryptographic helpers shared by sessions, invites, and owner/admin passwords.
// This file uses Web Crypto APIs available in Cloudflare Workers and local tests.
export type SessionPayload = {
  readonly memberId: string;
  readonly exp: number;
};

const encoder = new TextEncoder();

export const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

export const base64UrlDecode = (value: string): Uint8Array => {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const importKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

const exactArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

// Produces a compact HMAC-signed token: base64url(JSON payload).base64url(signature).
// The payload is readable by the browser, but cannot be changed without SESSION_SECRET.
export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${base64UrlEncode(signature)}`;
}

// Verifies the HMAC before decoding the session payload and rejects expired or
// malformed tokens by returning null instead of throwing.
export async function verifySession(token: string, secret: string, now = Date.now()): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) return null;
  const [body, signature] = parts;
  const key = await importKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, exactArrayBuffer(base64UrlDecode(signature)), encoder.encode(body));
  if (!ok) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as Partial<SessionPayload>;
    if (typeof parsed.memberId !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp <= now) return null;
    return { memberId: parsed.memberId, exp: parsed.exp };
  } catch {
    return null;
  }
}

// URL-safe random code used for invite IDs and other copyable secrets.
export function randomCode(bytes = 12): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64UrlEncode(data);
}

// Stores passwords as algorithm:iterations:salt:hash so future migrations can
// identify the format without a separate schema column.
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iterations = 100_000;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return `pbkdf2-sha256:${iterations}:${base64UrlEncode(salt)}:${base64UrlEncode(new Uint8Array(bits))}`;
}

// Re-derives the PBKDF2 hash and compares it without early-exit byte checks.
// Invite-only members have no stored password, so null always fails.
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (stored === null) return false;
  const [algorithm, iterationsText, saltText, hashText] = stored.split(":");
  if (algorithm !== "pbkdf2-sha256" || !iterationsText || !saltText || !hashText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) return false;
  const salt = base64UrlDecode(saltText);
  const expected = base64UrlDecode(hashText);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: exactArrayBuffer(salt), iterations }, key, expected.byteLength * 8);
  const actual = new Uint8Array(bits);
  if (actual.byteLength !== expected.byteLength) return false;
  let diff = 0;
  for (let index = 0; index < actual.byteLength; index++) diff |= actual[index] ^ expected[index];
  return diff === 0;
}
