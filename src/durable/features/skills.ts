// Group-created agent skills. Each skill is stored as metadata plus editable
// files so the UI can teach the resident agent group-specific behavior.
import type { DurableFeatureContext } from "../feature-context";
import type { Skill, SkillFile } from "../../protocol/chat";
import { skillFromRow, type SkillRow } from "../rows";
import { now, safeText } from "../validation";

export async function listSkills(ctx: DurableFeatureContext, memberId: string): Promise<Skill[]> {
  await ctx.requireMember(memberId);
  return ctx.state.storage.sql
    .exec<SkillRow>("SELECT id, slug, title, description, enabled, created_by, created_at, updated_at FROM skills ORDER BY updated_at DESC")
    .toArray()
    .map(skillFromRow);
}

// Creates a starter SKILL.md immediately so a new skill has useful content the
// owner/admin can edit instead of an empty file list.
export async function createSkill(ctx: DurableFeatureContext, input: { actorId: string; title: string; description: string }): Promise<Skill> {
  const actor = await ctx.requireMember(input.actorId);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can create skills");
  const title = safeText(input.title, "Skill title", 120);
  const description = safeText(input.description, "Skill description", 500);
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group-skill";
  let slug = base;
  for (let i = 2; skillSlugExists(ctx, slug); i++) slug = `${base}-${i}`;
  const createdAt = now();
  const skill: Skill = { id: crypto.randomUUID(), slug, title, description, enabled: true, createdBy: actor.id, createdAt, updatedAt: createdAt };
  ctx.state.storage.sql.exec(
    "INSERT INTO skills (id, slug, title, description, enabled, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
    skill.id, skill.slug, skill.title, skill.description, skill.createdBy, skill.createdAt, skill.updatedAt,
  );
  const content = `---\nname: ${skill.slug}\ndescription: ${skill.description}\n---\n\n# ${skill.title}\n\n${skill.description}\n\n## Instructions\n\n- Help the group with this skill when it is relevant.\n`;
  ctx.state.storage.sql.exec("INSERT INTO skill_files (skill_id, path, content, updated_at) VALUES (?, 'SKILL.md', ?, ?)", skill.id, content, createdAt);
  return skill;
}

export async function listSkillFiles(ctx: DurableFeatureContext, input: { actorId: string; skillId: string }): Promise<SkillFile[]> {
  await ctx.requireMember(input.actorId);
  requireSkill(ctx, input.skillId);
  return ctx.state.storage.sql
    .exec<{ path: string; content: string; updated_at: number }>("SELECT path, content, updated_at FROM skill_files WHERE skill_id = ? ORDER BY path", input.skillId)
    .toArray()
    .map((row) => ({ path: row.path, content: row.content, updatedAt: row.updated_at }));
}

// Paths are deliberately restricted to relative skill-file paths; this prevents
// UI-entered names from pretending to address host files or parent directories.
export async function updateSkillFile(ctx: DurableFeatureContext, input: { actorId: string; skillId: string; path: string; content: string }): Promise<SkillFile> {
  const actor = await ctx.requireMember(input.actorId);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can edit skills");
  requireSkill(ctx, input.skillId);
  const path = safeText(input.path, "Path", 160);
  if (path.includes("..") || path.startsWith("/")) throw new Error("Invalid skill file path");
  if (input.content.length > 40_000) throw new Error("Skill file is too large");
  const updatedAt = now();
  ctx.state.storage.sql.exec(
    `INSERT INTO skill_files (skill_id, path, content, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(skill_id, path) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    input.skillId, path, input.content, updatedAt,
  );
  ctx.state.storage.sql.exec("UPDATE skills SET updated_at = ? WHERE id = ?", updatedAt, input.skillId);
  return { path, content: input.content, updatedAt };
}

export async function setSkillEnabled(ctx: DurableFeatureContext, input: { actorId: string; skillId: string; enabled: boolean }): Promise<Skill> {
  const actor = await ctx.requireMember(input.actorId);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can update skills");
  requireSkill(ctx, input.skillId);
  const updatedAt = now();
  ctx.state.storage.sql.exec("UPDATE skills SET enabled = ?, updated_at = ? WHERE id = ?", input.enabled ? 1 : 0, updatedAt, input.skillId);
  return requireSkill(ctx, input.skillId);
}

function skillSlugExists(ctx: DurableFeatureContext, slug: string): boolean {
  return ctx.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM skills WHERE slug = ?", slug).one().count > 0;
}

function requireSkill(ctx: DurableFeatureContext, skillId: string): Skill {
  const row = ctx.state.storage.sql
    .exec<SkillRow>("SELECT id, slug, title, description, enabled, created_by, created_at, updated_at FROM skills WHERE id = ?", skillId)
    .toArray()[0];
  if (row === undefined) throw new Error("Skill not found");
  return skillFromRow(row);
}
