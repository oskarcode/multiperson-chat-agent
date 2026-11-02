import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, signSession, verifySession } from "../src/auth/crypto";

describe("MultiPersonChat password authentication", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("a-local-test-password");
    expect(hash).not.toContain("a-local-test-password");
    expect(await verifyPassword("a-local-test-password", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
    expect(await verifyPassword("a-local-test-password", null)).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow("at least 8");
  });

  it("rejects expired sessions and signatures from another secret", async () => {
    const token = await signSession({ memberId: "test-member", exp: 2000 }, "test-secret");
    expect(await verifySession(token, "test-secret", 1000)).toEqual({ memberId: "test-member", exp: 2000 });
    expect(await verifySession(token, "test-secret", 2000)).toBeNull();
    expect(await verifySession(token, "different-secret", 1000)).toBeNull();
  });});
