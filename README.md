# MultiPerson Chat with Agent

A small, self-hosted group chat application with a resident AI assistant. It runs as a single Cloudflare Worker with one SQLite-backed Durable Object, so it is a good starting point for teams, classrooms, clubs, support rooms, communities, or any multi-person chat where people can talk normally and explicitly ask an agent for help.

This project is intentionally direct: no frontend build step, no external database, and no required identity provider. The first user creates the chat space, then admins invite others with room invite links.

## What it does

- Hosts a browser chat UI from a Cloudflare Worker.
- Stores users, rooms, invites, messages, skills, schedules, AI settings, and connector metadata in Durable Object SQLite.
- Lets the first person create the owner account from the Worker URL.
- Lets invited users join a room with only their display name.
- Supports owner/admin password sign-in.
- Lets users send normal group messages or click **Ask Agent** for an AI response.
- Supports optional Workers AI or Anthropic model settings.
- Includes optional MCP connector plumbing for owner/admin tools.
- Includes simple schedules, skills, and proactive follow-up examples as extension points while the agent runtime migrates toward Pi Durable primitives.

## Quick deploy with a coding agent

Give your coding agent this prompt after replacing the account/Worker details with your own:

```text
Clone REPOSITORY_URL into a new folder named multiperson-chat-agent. Work only in that clone. Read AGENTS.md and wrangler.jsonc. Install dependencies, verify Wrangler login, then deploy a fresh Worker to my Cloudflare account using the repository deploy helper. Confirm the account ID/name and Worker name with me once before deploying. Use: pnpm deploy:agent --account ACCOUNT_ID --name WORKER_NAME --yes. Do not copy secrets from another project. Return the Worker URL and check result.
```

Manual equivalent:

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm deploy:agent --account ACCOUNT_ID --name WORKER_NAME --yes
```

The deploy helper runs `pnpm check`, deploys with Wrangler, creates `SESSION_SECRET` if the Worker is new, preserves existing secrets on updates, and smoke-checks `/api/me`.

## First-run user flow

1. Open the deployed Worker URL.
2. Enter your name, email, password, and chat space name.
3. Click **Create chat space**. You become the owner.
4. Create rooms or use the default **General room**.
5. Click **Invite people** in a room and share the private invite link.
6. Invitees open the link and enter their name. They do not need Cloudflare accounts.
7. Everyone can send group messages. Use **Ask Agent** when you want the resident AI to respond.

## How it works

```text
Browser UI
  -> Hono API routes in src/http/
  -> MultiPersonChat Durable Object in src/durable/multiperson-chat.ts
  -> SQLite Durable Object storage
  -> optional Workers AI / Anthropic / MCP services
```

### Main layers

- `src/index.ts` — tiny Worker entrypoint that exports the Durable Object and delegates HTTP to Hono.
- `src/http/app.ts` — Hono app composition root that mounts the API route groups.
- `src/http/routes/` — small route files grouped by feature: public auth, rooms/messages, invites, AI settings, skills, schedules, connectors, and MCP callback.
- `src/http/session.ts` and `src/http/input.ts` — session middleware plus JSON/body helpers for route handlers.
- `src/ui/app-html.ts` — assembles the no-build browser page from small UI strings.
- `src/ui/page.ts` — browser HTML body markup.
- `src/ui/styles.ts` — browser CSS.
- `src/ui/client-script.ts` — browser state, fetch calls, rendering, and event handlers.
- `src/durable/multiperson-chat.ts` — current app catalog Durable Object lifecycle and public RPC delegation.
- `src/session/pi-session.ts` — Pi Durable-backed per-room session Durable Object used as the migration target for conversations/tools/tasks.
- `src/session/schedule-task.ts` — Pi Durable task-backed Calendar records while model-callable schedule tools are migrated.
- `src/durable/features/` — focused state features: members, invites, workspaces, messages, connectors, AI settings, schedules, skills, and follow-ups.
- `src/durable/schema.ts` — SQLite schema.
- `src/durable/rows.ts` — SQLite row-to-protocol mappers.
- `src/durable/validation.ts` — shared text limits, validation, and AI response helpers.
- `src/chat-rpc.ts` — Durable Object RPC shape used by the Worker.
- `src/protocol/chat.ts` — shared product types.
- `src/auth/crypto.ts` and `src/auth/session.ts` — PBKDF2 password hashing and signed session cookies.
- `src/agent/` — model catalog and current Ask Agent prompt/provider calls; see `docs/pi-durable-migration.md` for the planned move to Pi Durable harness/tools.
- `src/integrations/mcp.ts` — MCP Streamable HTTP/OAuth adapter.
- `scripts/deploy-agent.mjs` — safe deployment helper for agents and humans.

## API overview

Public/setup routes:

- `GET /api/me` — returns session/setup state.
- `POST /api/setup` — creates the first owner and chat space.
- `POST /api/login` — signs in owner/admin users.
- `POST /api/join` — joins with an invite code and display name.
- `POST /api/logout` — clears the session cookie.
- `GET /api/mcp/callback` — handles MCP OAuth popup callbacks.

Authenticated routes:

- `GET /api/members`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:id/messages`
- `POST /api/workspaces/:id/messages`
- `GET /api/invites`
- `POST /api/invites`
- `POST /api/invites/accept`
- `DELETE /api/invites/:code`
- `GET /api/ai/settings`
- `POST /api/ai/settings`
- `GET /api/skills`
- `POST /api/skills`
- `GET /api/skills/:id/files`
- `PUT /api/skills/:id/files`
- `PUT /api/skills/:id/enabled`
- `GET /api/schedules`
- `POST /api/schedules`
- `DELETE /api/schedules/:id`
- `GET /api/connectors`
- `POST /api/connectors`
- `POST /api/connectors/:id/refresh`
- `POST /api/connectors/:id/tools/:name/call`

## Infrastructure

Cloudflare resources used:

- Worker runtime for HTTP routes and browser UI.
- Durable Object binding `CHAT` with SQLite storage for current app catalog/chat state.
- Durable Object binding `SESSIONS` with SQLite storage for the Pi Durable migration target.
- Workers AI binding `AI` for the default model path.
- Worker secret `SESSION_SECRET` for session cookies.
- Optional environment vars `AI_MODEL` and `AI_GATEWAY_ID`.
- Optional outbound HTTPS calls to Anthropic or MCP servers when configured.

No separate database, queue, CDN asset build, or external identity provider is required for the base app.

## Development

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm check
```

Optional browser test:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

## What to expand next

Good extension points:

- More room/member administration: remove members, rename rooms, archive rooms.
- Stronger invite controls: max uses, invite labels, email allowlists, expiry UI.
- Better notifications: email, push, unread counters, mentions.
- Richer agent tool use: safe automatic tool routing, more MCP servers, tool result previews.
- Pi Durable runtime migration: replace the current direct model call path with Pi Durable sessions, tools, task-backed schedules, diagnostics, and event projection.
- File attachments: R2-backed uploads with explicit size/type scanning.
- Multi-tenant SaaS: one Durable Object per organization or account.
- Search/export: transcript search, data export, retention controls.
- Observability: structured logs, metrics, admin diagnostics.

Things this starter deliberately does not try to be:

- A full Slack/Discord clone.
- A complete enterprise IAM product.
- A production compliance package.
- A general plugin framework.
- A multi-tenant billing system.

## Security notes

This starter has basic application security, not comprehensive production hardening.

Included:

- Owner/admin password sign-in.
- PBKDF2 password hashing.
- Signed HTTP-only session cookies.
- One-use room invite links.
- Durable Object membership checks before private room reads/writes.
- Secrets kept out of source and managed through Wrangler/Cloudflare.

You should review or add before production use:

- Password reset/account recovery.
- Member removal and session revocation.
- Rate limiting for login, setup, joins, and agent calls.
- CSRF strategy if you add cross-site flows.
- Stronger authorization policies for tools/connectors.
- Audit logs for admin actions.
- Data deletion/export/retention policies.
- Abuse controls for public invite links.
- A formal threat model for your use case.

## License

No license file is included yet. Add a license before publishing for reuse.
