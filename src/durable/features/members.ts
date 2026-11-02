// Member and setup behavior for the MultiPersonChat Durable Object.
// This module owns account rows, first-owner creation, and password login reads;
// session-cookie creation stays in the Worker route layer.
import type { DurableFeatureContext } from "../feature-context";
import type { Member, Role, SetupStatus } from "../../protocol/chat";
import { now, safeText, validEmail } from "../validation";

// Used by /api/me and the deploy smoke check to decide whether the app is
// waiting for first-owner setup or ready for normal sign-in.
export async function setupStatus(ctx: DurableFeatureContext): Promise<SetupStatus> {
  const count = ctx.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM members").one().count;
  const group = ctx.state.storage.sql.exec<{ value: string }>("SELECT value FROM settings WHERE key = 'group_name'").toArray()[0];
  return { configured: count > 0, memberCount: count, groupName: group ? JSON.parse(group.value) : "MultiPerson Chat" };
}

export async function setupAppOwner(ctx: DurableFeatureContext, input: { name: string; email: string; passwordHash: string; groupName?: string }): Promise<Member> {
  // No awaits inside the transaction: concurrent first-run setup requests cannot both become owner.
  return ctx.state.storage.transactionSync(() => {
    if (ctx.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM members").one().count > 0) throw new Error("Group is already configured");
    const member: Member = {
      id: crypto.randomUUID(),
      name: safeText(input.name, "Name"),
      email: validEmail(input.email),
      role: "owner",
      createdAt: now(),
    };
    ctx.state.storage.sql.exec(
      "INSERT INTO members (id, name, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      member.id, member.name, member.email, member.role, input.passwordHash, member.createdAt,
    );
    ctx.state.storage.sql.exec(
      "INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('group_name', ?, ?, ?)",
      JSON.stringify(safeText(input.groupName || "My group", "Space name")), member.id, now(),
    );
    const workspace = ctx.insertWorkspace(member.id, "General room");
    ctx.state.storage.sql.exec(
      "INSERT INTO messages (workspace_id, author_id, author_name, kind, text, created_at) VALUES (?, 'group-agent', 'Group Agent', 'agent', ?, ?)",
      workspace.id, "Welcome! Invite your group using Invite group above. Chat normally, or tap Ask Agent when you want AI help.", now(),
    );
    return member;
  });
}

// Password verification is imported lazily so the module remains mostly storage
// focused and so tests can exercise auth helpers independently.
export async function loginAppMember(ctx: DurableFeatureContext, input: { email: string; password: string }): Promise<Member> {
  const email = input.email.trim().toLowerCase();
  const row = ctx.state.storage.sql
    .exec<{ id: string; name: string; email: string | null; role: Role; created_at: number; password_hash: string | null }>(
      "SELECT id, name, email, role, created_at, password_hash FROM members WHERE lower(email) = ?",
      email,
    )
    .toArray()[0];
  if (row === undefined) throw new Error("Invalid email or password");
  const { verifyPassword } = await import("../../auth/crypto");
  if (!(await verifyPassword(input.password, row.password_hash))) throw new Error("Invalid email or password");
  return { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at };
}

export async function getMember(ctx: DurableFeatureContext, memberId: string): Promise<Member | null> {
  const row = ctx.state.storage.sql
    .exec<{ id: string; name: string; email: string | null; role: Role; created_at: number }>(
      "SELECT id, name, email, role, created_at FROM members WHERE id = ?",
      memberId,
    )
    .toArray()[0];
  return row === undefined
    ? null
    : { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at };
}

export async function listMembers(ctx: DurableFeatureContext): Promise<Member[]> {
  return ctx.state.storage.sql
    .exec<{ id: string; name: string; email: string | null; role: Role; created_at: number }>(
      "SELECT id, name, email, role, created_at FROM members ORDER BY created_at ASC",
    )
    .toArray()
    .map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at }));
}
