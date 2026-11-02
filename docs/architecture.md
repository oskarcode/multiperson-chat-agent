# MultiPerson Chat with Agent architecture

MultiPerson Chat with Agent is a single Cloudflare Worker with one SQLite-backed Durable Object. The design favors direct, product-specific modules over generic frameworks so the code is easy to read and extend.

## Runtime components

```text
Browser
  -> Worker static HTML/CSS/JS (`src/ui/app-html.ts`, assembled from `src/ui/page.ts`, `src/ui/styles.ts`, and `src/ui/client-script.ts`)
  -> Hono JSON API routes (`src/http/`)
  -> MultiPersonChat Durable Object (`src/durable/multiperson-chat.ts`)
  -> PiSession Durable Object migration target (`src/session/pi-session.ts`)
  -> SQLite Durable Object storage
  -> optional Workers AI / Anthropic / MCP services
```

## State owner

`MultiPersonChat` is the Durable Object state owner and composition root. It keeps the Durable Object lifecycle, schema initialization, alarm entrypoint, and public RPC method names in `src/durable/multiperson-chat.ts`, then delegates feature behavior to focused modules:

- `src/durable/features/members.ts` — first owner setup, member lookup, password login
- `src/durable/features/invites.ts` — one-use room invite creation, join, accept, list, revoke
- `src/durable/features/workspaces.ts` — room listing, creation, and membership authorization
- `src/durable/features/messages.ts` — transcript reads and message inserts
- `src/durable/features/connectors.ts` — MCP connector metadata, OAuth state, tool cache, tool calls
- `src/durable/features/ai-settings.ts` — AI provider/model/API-key settings
- `src/durable/features/skills.ts` — agent skills and skill files
- `src/durable/features/schedules.ts` — calendar/schedule records
- `src/durable/features/follow-ups.ts` — proactive follow-up records, classifier, delivery, alarms

Shared Durable Object helpers live in `src/durable/validation.ts`, `src/durable/rows.ts`, and `src/durable/feature-context.ts`.

The Durable Object binding and exported class name are deployment state:

- binding: `CHAT`
- class/export: `MultiPersonChat`
- storage: SQLite Durable Object storage

A second Durable Object binding, `SESSIONS`, points at `PiSession`. It currently opens a Pi Durable `Harness` and root conversation as the migration target for future transcript, tool, task, and schedule behavior. Public chat traffic still uses the `CHAT` object until the migration is complete.

## Security boundaries

- A fresh chat space is created from the Worker URL. The first completed setup creates the owner account.
- Owner/admin users sign in with email and password.
- Invited users open a room invite link and enter only a display name.
- Session cookies are signed with `SESSION_SECRET` and marked HTTP-only.
- Room authorization is checked in the Durable Object before reading or writing room state.
- API keys for external models are not returned to the browser.

## Request paths

`src/index.ts` is now intentionally tiny: it exports the Durable Object class and delegates HTTP handling to `src/http/app.ts`.

`src/http/app.ts` is the Hono route composition root:

1. mount each `/api/*` group from `src/http/routes/`
2. serve `appHtml` for browser GET/HEAD requests
3. convert thrown route errors to JSON responses
4. return JSON 404s for unknown API paths

Authenticated route groups use `src/http/session.ts:requireAuth`, which verifies the signed session cookie, loads the member from the Durable Object, and stores `{ member, chat }` on the Hono context before feature handlers run. Route handlers call the `MultiPersonChat` Durable Object through the `src/chat-rpc.ts` contract.

Main public API groups:

- `/api/me`, `/api/setup`, `/api/login`, `/api/join`, `/api/logout`
- `/api/workspaces`, `/api/workspaces/:id/messages`
- `/api/invites`, `/api/invites/accept`, `/api/invites/:code`
- `/api/ai/settings`
- `/api/connectors`, `/api/connectors/:id/refresh`, `/api/connectors/:id/tools/:name/call`
- `/api/mcp/callback`
- `/api/skills`, `/api/skills/:id/files`, `/api/skills/:id/enabled`
- `/api/schedules`, `/api/schedules/:id`

## Dependency direction

```text
src/ui/app-html.ts              -> assembles the no-build browser shell
src/ui/page.ts                  -> browser HTML body markup
src/ui/styles.ts                -> browser CSS
src/ui/client-script.ts         -> browser state, fetch callers, rendering, and event handlers; talks to HTTP API only
src/index.ts                    -> Worker entrypoint and Durable Object export
src/http/app.ts                 -> Hono route mounting and page fallback
src/http/routes/*               -> grouped API route handlers
src/session/pi-session.ts       -> Pi Durable-backed session Durable Object migration target
src/session/harness.ts          -> minimal Pi Durable harness composition
src/http/session.ts             -> signed session lookup and authenticated route middleware
src/http/input.ts               -> JSON/body/query helpers for route handlers
src/durable/multiperson-chat.ts -> Durable Object lifecycle and RPC delegation
src/durable/features/*          -> focused Durable Object feature behavior
src/durable/schema.ts           -> SQLite schema
src/durable/rows.ts             -> SQLite row-to-protocol mappers
src/durable/validation.ts       -> shared deterministic helpers
src/integrations/mcp.ts         -> pi-mcp client/OAuth adapter
src/agent/models.ts             -> model catalog and default model policy
src/agent/reply.ts              -> Ask Agent prompt construction and provider calls
src/auth/session.ts             -> signed HTTP-only session cookie helpers
src/auth/crypto.ts              -> password/session crypto helpers
src/protocol/chat.ts            -> runtime-neutral product protocol types
src/chat-rpc.ts                 -> Durable Object RPC contract
src/platform-env.ts             -> Cloudflare binding contract
```

Browser UI must not import Worker or Durable Object implementation modules. Protocol modules should remain inert: serializable types, contracts, constants, and pure validation only.

## Agent behavior

The resident agent is intentionally simple:

- normal group messages are stored without model calls
- `Ask Agent` calls the configured model with recent room transcript and settings context
- proactive follow-up logic can record and deliver follow-up messages from the Durable Object alarm path
- MCP connectors are available as owner/admin tools in settings, not as an automatic unrestricted tool loop

## Deployment

Deployment is managed by `scripts/deploy-agent.mjs`:

```sh
pnpm deploy:agent --account ACCOUNT_ID --name WORKER_NAME --yes
```

The helper verifies Wrangler authentication, checks the target, preserves existing secrets, runs `pnpm check`, deploys, and checks `/api/me`.

## Refactoring invariants

Do not change these during structural refactors unless explicitly planned:

- API paths, methods, response shapes, and status behavior
- `CHAT` binding and `MultiPersonChat` Durable Object export
- SQLite table names and migration semantics
- first-owner race protection
- invite one-time use, room scoping, expiry, and revocation
- private room membership checks before state access
- signed HTTP-only session cookie behavior
- Workers AI/Anthropic model settings semantics
- deploy helper secret preservation and safety checks
