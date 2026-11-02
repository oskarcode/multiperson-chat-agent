import { DurableObject } from "cloudflare:workers";
import type { Env } from "../platform-env";
import type { AiProvider, AiRuntimeSettings, AiSettings, ChatMessage, Connector, Member, Role, SetupStatus, Skill, SkillFile, Workspace } from "../protocol/chat";
import type { DurableFeatureContext } from "./feature-context";
import { CHAT_SCHEMA_SQL, LEGACY_COLUMNS } from "./schema";
import { getAiRuntimeSettings as readAiRuntimeSettings, getAiSettings as readAiSettings, updateAiSettings as saveAiSettings } from "./features/ai-settings";
import { addConnector as addStoredConnector, callConnectorTool as callStoredConnectorTool, completeConnectorOAuth as completeStoredConnectorOAuth, listConnectors as listStoredConnectorsForMember, refreshConnector as refreshStoredConnector } from "./features/connectors";
import { acceptInvite as acceptRoomInvite, createInvite as createRoomInvite, joinWithInvite as joinRoomWithInvite, listInvites as listRoomInvites, revokeInvite as revokeRoomInvite } from "./features/invites";
import { getMember as readMember, listMembers as readMembers, loginAppMember as loginMember, setupAppOwner as createInitialOwner, setupStatus as readSetupStatus } from "./features/members";
import { appendGroupMessage as appendStoredGroupMessage, insertMessage, listMessages as listStoredMessages, recentTranscript as readRecentTranscript, recentWorkspaceMessages } from "./features/messages";
import { createSkill as createStoredSkill, listSkillFiles as listStoredSkillFiles, listSkills as listStoredSkills, setSkillEnabled as setStoredSkillEnabled, updateSkillFile as updateStoredSkillFile } from "./features/skills";
import { deliverDueFollowUps, recoverInterruptedFollowUps, refreshFollowUpAlarm, trackFollowUp } from "./features/follow-ups";
import { createWorkspace as createStoredWorkspace, insertWorkspace, listAllWorkspaces, listWorkspaces as listMemberWorkspaces, requireWorkspaceMember as requireStoredWorkspaceMember } from "./features/workspaces";

// This class is the Durable Object boundary Cloudflare instantiates.
// Keep the public method names aligned with `src/chat-rpc.ts`; route code calls
// these methods through the Durable Object stub. Feature implementation lives in
// `src/durable/features/*`, but this class remains the state-owner composition root.
export class MultiPersonChat extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Schema setup must finish before any request method reads or writes SQLite.
    ctx.blockConcurrencyWhile(() => this.initialize());
  }

  async alarm(): Promise<void> {
    // Durable Object alarms resume background follow-up work after the request
    // that scheduled it has finished, so alarm handling stays at the DO boundary.
    await deliverDueFollowUps(this.featureContext());
    await refreshFollowUpAlarm(this.featureContext());
  }

  private async initialize(): Promise<void> {
    this.ctx.storage.sql.exec(CHAT_SCHEMA_SQL);
    // Legacy columns are additive migrations for older deployed DO storage.
    for (const column of LEGACY_COLUMNS) this.addColumnIfMissing(column.table, column.column, column.definition);
    // A deployment or eviction can stop an alarm after it claimed a follow-up.
    // Reset old claims on startup so the alarm loop can retry instead of dropping them.
    recoverInterruptedFollowUps(this.featureContext());
  }

  // Setup and members
  async setupStatus(): Promise<SetupStatus> {
    return readSetupStatus(this.featureContext());
  }

  async setupAppOwner(input: { name: string; email: string; passwordHash: string; groupName?: string }): Promise<Member> {
    return createInitialOwner(this.featureContext(), input);
  }

  async loginAppMember(input: { email: string; password: string }): Promise<Member> {
    return loginMember(this.featureContext(), input);
  }

  async getMember(memberId: string): Promise<Member | null> {
    return readMember(this.featureContext(), memberId);
  }

  async listMembers(): Promise<Member[]> {
    return readMembers(this.featureContext());
  }

  // Invites
  async createInvite(input: { actorId: string; workspaceId: string; role: Role }): Promise<{ code: string; role: Role; workspaceId: string; expiresAt: number }> {
    return createRoomInvite(this.featureContext(), input);
  }

  async joinWithInvite(input: { code: string; name: string; email?: string | null; passwordHash?: string | null }): Promise<Member> {
    return joinRoomWithInvite(this.featureContext(), input);
  }

  async acceptInvite(input: { actorId: string; code: string }): Promise<{ workspaceId: string }> {
    return acceptRoomInvite(this.featureContext(), input);
  }

  async listInvites(input: { actorId: string; workspaceId: string }): Promise<{ code: string; expiresAt: number }[]> {
    return listRoomInvites(this.featureContext(), input);
  }

  async revokeInvite(input: { actorId: string; code: string }): Promise<void> {
    return revokeRoomInvite(this.featureContext(), input);
  }

  // Workspaces and messages
  async listWorkspaces(memberId: string): Promise<Workspace[]> {
    return listMemberWorkspaces(this.featureContext(), memberId);
  }

  async createWorkspace(input: { actorId: string; title: string }): Promise<Workspace> {
    return createStoredWorkspace(this.featureContext(), input);
  }

  async listMessages(input: { actorId: string; workspaceId: string }): Promise<ChatMessage[]> {
    return listStoredMessages(this.featureContext(), input);
  }

  async recentTranscript(input: { actorId: string; workspaceId: string; limit: number }): Promise<ChatMessage[]> {
    return readRecentTranscript(this.featureContext(), input);
  }

  async appendGroupMessage(input: { actorId: string; workspaceId: string; text: string; kind: "group" | "agent-request" }): Promise<ChatMessage> {
    return appendStoredGroupMessage(this.featureContext(), input);
  }

  // MCP connectors
  async listConnectors(memberId: string): Promise<Connector[]> {
    return listStoredConnectorsForMember(this.featureContext(), memberId);
  }

  async addConnector(input: { actorId: string; label: string; url: string; publicOrigin: string }): Promise<Connector> {
    return addStoredConnector(this.featureContext(), input);
  }

  async refreshConnector(input: { actorId: string; connectorId: string; publicOrigin: string }): Promise<Connector> {
    return refreshStoredConnector(this.featureContext(), input);
  }

  async completeConnectorOAuth(input: { connectorId: string; callbackUrl: string; publicOrigin: string }): Promise<Connector> {
    return completeStoredConnectorOAuth(this.featureContext(), input);
  }

  async callConnectorTool(input: { actorId: string; connectorId: string; publicOrigin: string; toolName: string; args: Record<string, unknown> }): Promise<unknown> {
    return callStoredConnectorTool(this.featureContext(), input);
  }

  // AI settings
  async getAiSettings(memberId: string): Promise<AiSettings | null> {
    return readAiSettings(this.featureContext(), memberId);
  }

  async getAiRuntimeSettings(memberId: string): Promise<AiRuntimeSettings | null> {
    return readAiRuntimeSettings(this.featureContext(), memberId);
  }

  async updateAiSettings(input: { actorId: string; provider: AiProvider; model: string; apiKey?: string | null }): Promise<AiSettings> {
    return saveAiSettings(this.featureContext(), input);
  }

  // Skills
  async listSkills(memberId: string): Promise<Skill[]> {
    return listStoredSkills(this.featureContext(), memberId);
  }

  async createSkill(input: { actorId: string; title: string; description: string }): Promise<Skill> {
    return createStoredSkill(this.featureContext(), input);
  }

  async listSkillFiles(input: { actorId: string; skillId: string }): Promise<SkillFile[]> {
    return listStoredSkillFiles(this.featureContext(), input);
  }

  async updateSkillFile(input: { actorId: string; skillId: string; path: string; content: string }): Promise<SkillFile> {
    return updateStoredSkillFile(this.featureContext(), input);
  }

  async setSkillEnabled(input: { actorId: string; skillId: string; enabled: boolean }): Promise<Skill> {
    return setStoredSkillEnabled(this.featureContext(), input);
  }

  // Shared authorization helpers. Feature modules call these through the context
  // instead of duplicating member and room access checks.
  private async requireMember(memberId: string): Promise<Member> {
    const member = await this.getMember(memberId);
    if (member === null) throw new Error("Member not found");
    return member;
  }

  private async requireWorkspaceMember(memberId: string, workspaceId: string): Promise<Member> {
    return requireStoredWorkspaceMember(this.featureContext(), memberId, workspaceId);
  }

  private addColumnIfMissing(table: string, column: string, definition: string): void {
    const columns = this.ctx.storage.sql.exec<{ name: string }>(`PRAGMA table_info(${table})`).toArray();
    if (columns.some((existing) => existing.name === column)) return;
    this.ctx.storage.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private featureContext(): DurableFeatureContext {
    // The context is intentionally small and explicit: feature modules receive
    // only storage, env, and cross-feature operations they truly need. This keeps
    // dependencies visible without introducing repositories or a framework.
    return {
      state: this.ctx,
      env: this.env,
      requireMember: (memberId) => this.requireMember(memberId),
      requireWorkspaceMember: (memberId, workspaceId) => this.requireWorkspaceMember(memberId, workspaceId),
      insertWorkspace: (actorId, title) => insertWorkspace({ state: this.ctx }, actorId, title),
      listAllWorkspaces: () => listAllWorkspaces({ state: this.ctx }),
      insertMessage: (workspaceId, authorId, authorName, kind, text) => insertMessage({ state: this.ctx }, workspaceId, authorId, authorName, kind, text),
      recentWorkspaceMessages: (workspaceId, limit) => recentWorkspaceMessages({ state: this.ctx }, workspaceId, limit),
      trackFollowUp: (message) => trackFollowUp(this.featureContext(), message),
    };
  }
}
