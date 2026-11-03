# MultiPerson Chat with Agent

A small Cloudflare Workers demo for shareable group-chat workspaces. An admin creates a workspace and shares its URL; anyone with that link can join without signing in. Hono routes HTTP requests and WebSocket upgrades to a SQLite-backed `ChatRoom` Durable Object per workspace. Pi Durable owns each conversation; the agent can answer, stream its activity, schedule reminders and follow-ups, and use one public MCP server shared by all workspaces.

This is a demo, not an authenticated chat product. A workspace URL is a bearer link: anyone who has it can read and post. The admin area is separately protected by one Worker secret.

## Demo flow

1. Open `/admin`, enter the admin secret, and create a named workspace. Admins can also permanently delete a workspace and its chat data.
2. Copy its `/w/<id>` link and share it with guests. The link selects the workspace; guests only choose a display name and do not need accounts or a secret.
3. Chat together or ask the workspace agent for help. The partial answer streams in the chat; **Live agent activity** shows run status and tool calls without duplicating response tokens.
4. Optionally connect one public Streamable HTTP MCP endpoint in the admin UI. Its discovered tools become available in every workspace.
5. Ask the agent to schedule a reminder. Pi Durable stores the task and the room Durable Object wakes when it is due.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm admin:secret
pnpm exec wrangler dev
```

`pnpm admin:secret` creates a random local `ADMIN_SECRET` in the ignored `.dev.vars` file and never prints its value. Read that file locally to unlock `/admin`. The deploy helper also creates this local secret if needed and provisions the same value to Cloudflare. Do not commit or share `.dev.vars`.

Workers AI is configured in `wrangler.jsonc` with default model `@cf/zai-org/glm-4.7-flash`. Agent calls during local development still use Cloudflare Workers AI remotely and may incur usage charges.

## How it works

```text
Admin browser
  -> Worker checks ADMIN_SECRET
  -> DemoAdmin Durable Object
       -> workspace index and global MCP URL
       -> creates a random workspace ID and initializes its ChatRoom

Guest browser -> /w/<workspace-id> (public share link)
  -> Worker routes to ROOMS.getByName(workspace-id)
  -> ChatRoom Durable Object per workspace
       -> workspace metadata, Pi Durable Harness, and one conversation
       -> group messages, agent turns, schedules, follow-ups, and hibernatable WebSocket snapshots
       -> reads the shared MCP URL from DemoAdmin
  -> Workers AI and optional public Streamable HTTP MCP server
```

- `src/index.ts` — Hono HTTP routing, workspace lookup, WebSocket upgrade proxying, and admin-secret-guarded API.
- `src/admin/demo-admin.ts` — workspace index and one global MCP configuration in a singleton Durable Object.
- `src/session/chat-room.ts` — one workspace Durable Object; owns that workspace's Harness, conversation, transcript, tasks, alarm lifecycle, hibernatable WebSocket handlers, and Pi Durable broadcast watch.
- `src/session/workspace-info.ts` — workspace ID/title/timestamp stored in the Pi Durable conversation state.
- `src/session/harness.ts` — Workers AI provider, prompt, Pi tools, and durable task registration.
- `src/session/transcript.ts` — projects Pi Durable entries and `pi.live` state into browser snapshots.
- `src/session/schedule-task.ts` and `src/session/schedule-tools.ts` — Pi-native reminder tools and task delivery.
- `src/session/follow-up-classifier.ts` and `src/session/follow-up-task.ts` — classify open turns, cancel stale candidates, and deliver follow-ups.
- `src/integrations/mcp.ts` — public HTTPS Streamable HTTP MCP client.
- `src/ui/` — no-build chat and admin pages with browser JavaScript.
- `worker-configuration.d.ts` — Wrangler-generated binding types.

### Agent streaming

The workspace Durable Object maintains one Pi Durable conversation watch and broadcasts snapshots over hibernatable WebSockets. Partial assistant text streams in the chat transcript. The collapsible activity panel shows agent start/response status and named tool-call events, not response tokens. Idle Durable Objects can hibernate while sockets remain connected; after wake, the constructor rebuilds the Harness watch and broadcasts a current snapshot. The browser reconnects with backoff and retries unacknowledged sends using stable request IDs.

### Automatic follow-up

After a group message, Workers AI reviews the recent conversation for unanswered questions, requests, decisions, and blockers—not just question marks in the newest line. If a useful check-in is warranted, Pi Durable schedules it for a 15-minute quiet period. New group messages reset the review; an agent answer also triggers a fresh review and invalidates stale follow-ups. The follow-up task reads the conversation context before writing its check-in.

### MCP configuration

The admin UI connects and tests one public HTTPS Streamable HTTP MCP server, then saves the endpoint globally for all workspaces. Guests can see the advertised tools and the agent can call them. OAuth, private endpoints, and saved credentials are not supported. The admin secret is required to change this outbound destination.

## API

Public, link-based guest routes:

- `GET /w/:workspaceId` — chat UI for a created workspace.
- `GET /api/workspaces/:workspaceId/socket` — hibernatable WebSocket for snapshots and guest sends. Client messages use `{ type: "send", target: "group" | "agent", requestId, authorName, text }`.
- `GET /api/workspaces/:workspaceId/messages` — current transcript.
- `GET /api/workspaces/:workspaceId/mcp` — shared MCP tool status.

Admin routes require `Authorization: Bearer <ADMIN_SECRET>`:

- `GET /api/admin/state` — list workspaces and current global MCP status.
- `POST /api/admin/workspaces` — create and initialize a named workspace.
- `DELETE /api/admin/workspaces/:workspaceId` — disable the share link and permanently clear the workspace conversation, tasks, and alarm.
- `PUT /api/admin/mcp` — connect/test a public endpoint, or disconnect with an empty URL.

## Checks

```sh
pnpm check
node scripts/test-browser.mjs
```

Checks cover admin-secret gating, workspace creation/deletion and state, public guest sharing without an ID field, workspace isolation, Hono routing, WebSocket snapshots and sends, idle connection continuity, status-only activity-panel rendering with tool names, MCP URL validation, context-aware follow-up classification/task behavior, Wrangler packaging, and browser layout. Tests use a mocked Workers AI binding; local idle-connection coverage does not prove a production hibernation event. Tests also do not prove live Workers AI, live MCP-server, or wall-clock reminder delivery.

## Deploy

```sh
pnpm deploy:agent --account ACCOUNT_ID --name WORKER_NAME --yes
```

The helper verifies the Wrangler account, runs checks, deploys, and smoke-checks the chat page. It stores a random admin secret in ignored `.dev.vars` if one is not already there, then uploads it as the Worker secret `ADMIN_SECRET` if the deployed Worker does not already have that secret. Open `<Worker URL>/admin` and read the local `.dev.vars` value to unlock the admin UI; the secret is never printed by the helper.

The prior deployment already retired the old `MultiPersonChat` and `PiSession` classes. This change keeps the deployed `ChatRoom` class and adds `DemoAdmin`; existing ChatRoom data is not migrated or reset by this change.

## Production boundary

There is no guest authentication, workspace membership, or private-room ACL. The share URL grants read/write access. Protect the single admin secret, and rotate it if it is exposed. Public HTTPS MCP endpoints and their tools are shared with every guest workspace. Add identity, authorization, rate limits, and abuse controls before using this demo for sensitive or production traffic.
