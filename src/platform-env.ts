export interface Env {
  readonly CHAT: DurableObjectNamespace;
  readonly AI: Ai;
  readonly AI_MODEL?: string;
  readonly AI_GATEWAY_ID?: string;
  readonly SESSION_SECRET?: string;
}
