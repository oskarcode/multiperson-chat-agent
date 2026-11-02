// Room-invite behavior. Invites are one-use, room-scoped, and time-limited so
// link holders only gain access to the room they were invited into.
import { randomCode } from "../../auth/crypto";
import type { DurableFeatureContext } from "../feature-context";
import type { Member, Role } from "../../protocol/chat";
import { INVITE_TTL_MS, normalizeRole, now, safeText, validEmail } from "../validation";

export async function createInvite(ctx: DurableFeatureContext, input: { actorId: string; workspaceId: string; role: Role }): Promise<{ code: string; role: Role; workspaceId: string; expiresAt: number }> {
  const actor = await ctx.requireWorkspaceMember(input.actorId, input.workspaceId);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can invite members");
  const code = randomCode(10);
  const role = normalizeRole(input.role === "owner" ? "member" : input.role);
  if (role === "admin" && actor.role !== "owner") throw new Error("Only owners can invite admins");
  const createdAt = now();
  const expiresAt = createdAt + INVITE_TTL_MS;
  ctx.state.storage.sql.exec(
    "INSERT INTO invites (code, role, created_by, created_at, expires_at, workspace_id) VALUES (?, ?, ?, ?, ?, ?)",
    code,
    role,
    actor.id,
    createdAt,
    expiresAt,
    input.workspaceId,
  );
  return { code, role, workspaceId: input.workspaceId, expiresAt };
}

export async function joinWithInvite(ctx: DurableFeatureContext, input: { code: string; name: string; email?: string | null; passwordHash?: string | null }): Promise<Member> {
  // Joining and consuming the invite are atomic: a code cannot create two members
  // even if two browser tabs submit it at the same time.
  return ctx.state.storage.transactionSync(() => {
    const code = safeText(input.code, "Invite code", 200);
    const invite = availableInvite(ctx, code);
    const email = input.email && input.email.trim().length > 0 ? validEmail(input.email) : null;
    if (email !== null && ctx.state.storage.sql.exec("SELECT id FROM members WHERE lower(email) = ?", email).toArray().length) throw new Error("An account with this email already exists. Sign in to accept the invite.");
    const member: Member = {
      id: crypto.randomUUID(),
      name: safeText(input.name, "Name"),
      email,
      role: invite.role,
      createdAt: now(),
    };
    ctx.state.storage.sql.exec(
      "INSERT INTO members (id, name, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      member.id, member.name, member.email, member.role, input.passwordHash ?? null, member.createdAt,
    );
    consumeInvite(ctx, code, member.id, invite.workspace_id);
    return member;
  });
}

// Existing signed-in members can accept a room invite without changing their
// global group role or password/email setup.
export async function acceptInvite(ctx: DurableFeatureContext, input: { actorId: string; code: string }): Promise<{ workspaceId: string }> {
  await ctx.requireMember(input.actorId);
  return ctx.state.storage.transactionSync(() => {
    const invite = availableInvite(ctx, input.code);
    consumeInvite(ctx, input.code, input.actorId, invite.workspace_id);
    return { workspaceId: invite.workspace_id };
  });
}

export async function listInvites(ctx: DurableFeatureContext, input: { actorId: string; workspaceId: string }): Promise<{ code: string; expiresAt: number }[]> {
  const actor = await ctx.requireWorkspaceMember(input.actorId, input.workspaceId);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can manage invites");
  return ctx.state.storage.sql.exec<{ code: string; expires_at: number }>("SELECT code, expires_at FROM invites WHERE workspace_id = ? AND used_by IS NULL AND expires_at > ? ORDER BY created_at DESC", input.workspaceId, now()).toArray().map(row => ({ code: row.code, expiresAt: row.expires_at }));
}

export async function revokeInvite(ctx: DurableFeatureContext, input: { actorId: string; code: string }): Promise<void> {
  const invite = ctx.state.storage.sql.exec<{ workspace_id: string | null }>("SELECT workspace_id FROM invites WHERE code = ?", input.code).toArray()[0];
  if (!invite?.workspace_id) throw new Error("Invite not found");
  const actor = await ctx.requireWorkspaceMember(input.actorId, invite.workspace_id);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can manage invites");
  ctx.state.storage.sql.exec("DELETE FROM invites WHERE code = ?", input.code);
}

function availableInvite(ctx: DurableFeatureContext, code: string): { workspace_id: string; role: Role } {
  const invite = ctx.state.storage.sql.exec<{ workspace_id: string | null; role: Role; used_by: string | null; expires_at: number }>("SELECT workspace_id, role, used_by, expires_at FROM invites WHERE code = ?", code).toArray()[0];
  // Legacy group-wide invites must be replaced, never expanded to all rooms.
  if (!invite?.workspace_id || invite.used_by !== null || invite.expires_at <= now() || !ctx.state.storage.sql.exec("SELECT id FROM workspaces WHERE id = ?", invite.workspace_id).toArray().length) throw new Error("Invite is invalid or expired. Ask for a new room invite.");
  return { workspace_id: invite.workspace_id, role: invite.role };
}

function consumeInvite(ctx: DurableFeatureContext, code: string, memberId: string, workspaceId: string): void {
  // Workspace membership is idempotent, but invite use is recorded so the link
  // no longer appears in active invite lists and cannot be reused.
  ctx.state.storage.sql.exec("INSERT OR IGNORE INTO workspace_members (workspace_id, member_id, role, created_at) VALUES (?, ?, 'member', ?)", workspaceId, memberId, now());
  ctx.state.storage.sql.exec("UPDATE invites SET used_by = ? WHERE code = ?", memberId, code);
}
