// Workspace behavior. A workspace is a private room; reads and writes must pass
// through membership checks before returning messages or room metadata.
import type { DurableFeatureContext, StorageFeatureContext } from "../feature-context";
import type { Member, Workspace } from "../../protocol/chat";
import { workspaceFromRow, type WorkspaceRow } from "../rows";
import { now, safeText } from "../validation";

export async function listWorkspaces(ctx: DurableFeatureContext, memberId: string): Promise<Workspace[]> {
  await ctx.requireMember(memberId);
  return ctx.state.storage.sql
    .exec<WorkspaceRow>(
      `SELECT w.id, w.title, w.created_by, w.created_at
       FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.member_id = ? ORDER BY w.created_at DESC`,
      memberId,
    )
    .toArray()
    .map(workspaceFromRow);
}

export async function createWorkspace(ctx: DurableFeatureContext, input: { actorId: string; title: string }): Promise<Workspace> {
  const actor = await ctx.requireMember(input.actorId);
  return ctx.state.storage.transactionSync(() => insertWorkspace(ctx, actor.id, input.title));
}

// Shared by first-owner setup and normal room creation. The creator is inserted
// as the room owner in the same helper so rooms are never orphaned.
export function insertWorkspace(ctx: StorageFeatureContext, actorId: string, title: string): Workspace {
  const workspace: Workspace = {
    id: crypto.randomUUID(),
    title: safeText(title, "Workspace title"),
    createdBy: actorId,
    createdAt: now(),
  };
  ctx.state.storage.sql.exec(
    "INSERT INTO workspaces (id, title, created_by, created_at) VALUES (?, ?, ?, ?)",
    workspace.id,
    workspace.title,
    workspace.createdBy,
    workspace.createdAt,
  );
  ctx.state.storage.sql.exec(
    "INSERT INTO workspace_members (workspace_id, member_id, role, created_at) VALUES (?, ?, 'owner', ?)",
    workspace.id, actorId, now(),
  );
  return workspace;
}

// Central room-authorization gate used before any private room state is read or
// written. The user-facing error intentionally does not reveal whether the room exists.
export async function requireWorkspaceMember(ctx: DurableFeatureContext, memberId: string, workspaceId: string): Promise<Member> {
  const member = await ctx.requireMember(memberId);
  const row = ctx.state.storage.sql
    .exec<{ count: number }>(
      "SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ? AND member_id = ?",
      workspaceId,
      memberId,
    )
    .one();
  if (row.count === 0) throw new Error("Workspace not found");
  return member;
}

export async function listAllWorkspaces(ctx: StorageFeatureContext): Promise<Workspace[]> {
  return ctx.state.storage.sql
    .exec<WorkspaceRow>("SELECT id, title, created_by, created_at FROM workspaces ORDER BY created_at DESC")
    .toArray()
    .map(workspaceFromRow);
}
