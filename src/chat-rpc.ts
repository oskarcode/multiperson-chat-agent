import type {
  AiProvider,
  AiRuntimeSettings,
  AiSettings,
  ChatMessage,
  Connector,
  Member,
  Role,
  SetupStatus,
  Skill,
  SkillFile,
  Workspace,
} from "./protocol/chat";

export interface MultiPersonChatRpc {
  setupStatus(): Promise<SetupStatus>;
  setupAppOwner(input: {
    name: string;
    email: string;
    passwordHash: string;
    groupName?: string;
  }): Promise<Member>;
  acceptInvite(input: { actorId: string; code: string }): Promise<{ workspaceId: string }>;
  listInvites(input: { actorId: string; workspaceId: string }): Promise<{ code: string; expiresAt: number }[]>;
  revokeInvite(input: { actorId: string; code: string }): Promise<void>;
  loginAppMember(input: { email: string; password: string }): Promise<Member>;
  getMember(memberId: string): Promise<Member | null>;
  listMembers(): Promise<Member[]>;
  createInvite(input: {
    actorId: string;
    workspaceId: string;
    role: Role;
  }): Promise<{ code: string; role: Role; workspaceId: string; expiresAt: number }>;
  joinWithInvite(input: {
    code: string;
    name: string;
    email?: string | null;
    passwordHash?: string | null;
  }): Promise<Member>;
  listWorkspaces(memberId: string): Promise<Workspace[]>;
  createWorkspace(input: { actorId: string; title: string }): Promise<Workspace>;
  listMessages(input: { actorId: string; workspaceId: string }): Promise<ChatMessage[]>;
  appendGroupMessage(input: {
    actorId: string;
    workspaceId: string;
    text: string;
    kind: "group" | "agent-request";
  }): Promise<ChatMessage>;
  appendAgentMessage(input: { workspaceId: string; text: string }): Promise<ChatMessage>;
  recentTranscript(input: { actorId: string; workspaceId: string; limit: number }): Promise<ChatMessage[]>;
  listConnectors(memberId: string): Promise<Connector[]>;
  addConnector(input: { actorId: string; label: string; url: string; publicOrigin: string }): Promise<Connector>;
  refreshConnector(input: { actorId: string; connectorId: string; publicOrigin: string }): Promise<Connector>;
  completeConnectorOAuth(input: { connectorId: string; callbackUrl: string; publicOrigin: string }): Promise<Connector>;
  callConnectorTool(input: {
    actorId: string;
    connectorId: string;
    publicOrigin: string;
    toolName: string;
    args: Record<string, unknown>;
  }): Promise<unknown>;
  getAiSettings(memberId: string): Promise<AiSettings | null>;
  getAiRuntimeSettings(memberId: string): Promise<AiRuntimeSettings | null>;
  updateAiSettings(input: {
    actorId: string;
    provider: AiProvider;
    model: string;
    apiKey?: string | null;
  }): Promise<AiSettings>;
  listSkills(memberId: string): Promise<Skill[]>;
  createSkill(input: { actorId: string; title: string; description: string }): Promise<Skill>;
  listSkillFiles(input: { actorId: string; skillId: string }): Promise<SkillFile[]>;
  updateSkillFile(input: {
    actorId: string;
    skillId: string;
    path: string;
    content: string;
  }): Promise<SkillFile>;
  setSkillEnabled(input: { actorId: string; skillId: string; enabled: boolean }): Promise<Skill>;
}
