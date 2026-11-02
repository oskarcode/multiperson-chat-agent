// Explicit dependency object passed from MultiPersonChat into feature modules.
// It keeps each feature testable/readable without giving modules the whole
// Durable Object instance or hiding dependencies behind a generic repository.
import type { Env } from "../platform-env";
import type { ChatMessage, Member, Workspace } from "../protocol/chat";

export interface DurableFeatureContext {
  readonly state: DurableObjectState;
  readonly env: Env;
  requireMember(memberId: string): Promise<Member>;
  requireWorkspaceMember(memberId: string, workspaceId: string): Promise<Member>;
  insertWorkspace(actorId: string, title: string): Workspace;
  listAllWorkspaces(): Promise<Workspace[]>;
  insertMessage(workspaceId: string, authorId: string, authorName: string, kind: ChatMessage["kind"], text: string): ChatMessage;
  recentWorkspaceMessages(workspaceId: string, limit: number): ChatMessage[];
  trackFollowUp(message: ChatMessage): Promise<void>;
}

// Narrow context variants are for pure storage helpers that do not need auth,
// AI bindings, or cross-feature callbacks.
export type StorageFeatureContext = Pick<DurableFeatureContext, "state">;
export type EnvFeatureContext = Pick<DurableFeatureContext, "state" | "env">;
