// SQLite uses snake_case column names, while the browser/API protocol uses
// camelCase objects. These mappers keep that conversion in one predictable place.
import type { ChatMessage, Skill, Workspace } from "../protocol/chat";

export type WorkspaceRow = { id: string; title: string; created_by: string; created_at: number };
export type SkillRow = { id: string; slug: string; title: string; description: string; enabled: number; created_by: string; created_at: number; updated_at: number };
export type MessageRow = { id: number; workspace_id: string; author_id: string; author_name: string; kind: ChatMessage["kind"]; text: string; created_at: number };

export const workspaceFromRow = (row: WorkspaceRow): Workspace => ({ id: row.id, title: row.title, createdBy: row.created_by, createdAt: row.created_at });

export const skillFromRow = (row: SkillRow): Skill => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  enabled: row.enabled === 1,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const messageFromRow = (row: MessageRow): ChatMessage => ({
  id: row.id,
  workspaceId: row.workspace_id,
  authorId: row.author_id,
  authorName: row.author_name,
  kind: row.kind,
  text: row.text,
  createdAt: row.created_at,
});
