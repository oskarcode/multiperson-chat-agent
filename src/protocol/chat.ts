export type Role = "owner" | "admin" | "member";

export type Member = {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly role: Role;
  readonly createdAt: number;
};

export type Workspace = {
  readonly id: string;
  readonly title: string;
  readonly createdBy: string;
  readonly createdAt: number;
};

export type ChatMessage = {
  readonly id: number;
  readonly workspaceId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly kind: "group" | "agent-request" | "agent" | "system";
  readonly text: string;
  readonly createdAt: number;
};

export type McpToolSummary = {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly inputSchema?: unknown;
};

export type Connector = {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly createdBy: string;
  readonly createdAt: number;
  readonly status: "connected" | "authorization_required" | "failed" | "untested";
  readonly authorizationUrl?: string;
  readonly tools: McpToolSummary[];
  readonly lastError: string | null;
};

export type AiProvider = "workers-ai" | "anthropic";

export type AiSettings = {
  readonly provider: AiProvider;
  readonly model: string;
  readonly apiKeyConfigured?: boolean;
  readonly updatedAt?: number;
};

export type AiRuntimeSettings = AiSettings & {
  readonly apiKey?: string;
};

export type Skill = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly createdBy: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type SkillFile = {
  readonly path: string;
  readonly content: string;
  readonly updatedAt: number;
};

export type Schedule = {
  readonly id: string;
  readonly workspaceId: string;
  readonly workspaceTitle?: string;
  readonly instruction: string;
  readonly runAt: number;
  readonly createdBy: string;
  readonly createdAt: number;
};

export type SetupStatus = {
  readonly configured: boolean;
  readonly memberCount: number;
  readonly groupName?: string;
};

