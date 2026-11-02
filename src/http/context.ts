import type { Context, MiddlewareHandler } from "hono";
import type { MultiPersonChatRpc } from "../chat-rpc";
import type { Env } from "../platform-env";
import type { Member } from "../protocol/chat";

const CHAT_DO_NAME = "default-group";

export type Authed = {
  readonly member: Member;
  readonly chat: MultiPersonChatRpc;
};

export type AppBindings = {
  Bindings: Env;
  Variables: {
    auth: Authed;
  };
};

export type AppContext = Context<AppBindings>;
export type AppMiddleware = MiddlewareHandler<AppBindings>;

// A single named Durable Object owns all state for this starter deployment. Keep
// the name stable or existing groups would appear to lose their stored data.
export const chatStub = (env: Env): MultiPersonChatRpc => env.CHAT.getByName(CHAT_DO_NAME) as unknown as MultiPersonChatRpc;

export const isAdmin = (member: Member): boolean => member.role === "owner" || member.role === "admin";
