# MultiPerson Chat with Agent

A small Cloudflare Workers demo for shareable group-chat workspaces. An admin creates a workspace and shares its URL; anyone with that link can join without signing in. Hono routes HTTP requests and WebSocket upgrades to a SQLite-backed `ChatRoom` Durable Object per workspace. Pi Durable owns each conversation; the agent can answer, stream its activity, schedule reminders and follow-ups, and use up to eight named public MCP servers shared by all workspaces.

This is a demo, not an authenticated chat product. A workspace URL is a bearer link: anyone who has it can read and post. The chat sidebar remembers workspaces opened in the current browser; it is local history, not an account or membership list. Admins can unlock global workspace and MCP controls from **Settings** at the bottom of the sidebar. `/admin` remains available as a separate admin page.

## Demo flow

1. Open the chat homepage and select **Settings** at the bottom of the left sidebar. Enter the admin secret to see all workspaces, create a workspace with an automatic title, or permanently delete a workspace and its chat data.
2. Copy a workspace share link from Settings and share it with guests. The link selects the workspace; guests only choose a display name and do not need accounts or a secret. Workspaces guests open appear in that browser's sidebar.
3. Chat together or ask the workspace agent for help. The partial answer streams in the chat; **Agent activity** is collapsed by default and can be expanded to inspect run status and tool calls. The composer displays the configured model name (default: GLM 5.3).
4. Optionally connect up to eight named public Streamable HTTP MCP endpoints in **Settings**. Their discovered tools become available in every workspace, with server IDs distinguishing duplicate tool names.
5. Ask the agent to schedule a reminder. Pi Durable stores the task and the room Durable Object wakes when it is due.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm admin:secret
pnpm exec wrangler dev
```

`pnpm admin:secret` creates a random local `ADMIN_SECRET` in the ignored `.dev.vars` file and never prints its value. Read that file locally to unlock **Settings** in the chat sidebar or `/admin`. The deploy helper also creates this local secret if needed and provisions the same value to Cloudflare. Do not commit or share `.dev.vars`.

Workers AI is configured in `wrangler.jsonc` with default model `@cf/zai-org/glm-5.3`. GLM-5.3 requires a Workers Paid plan or prepaid AI Gateway credits; agent calls during local development still use Cloudflare Workers AI remotely and may incur usage charges.

## How it works

```text
Admin browser
  -> Worker checks ADMIN_SECRET
  -> DemoAdmin Durable Object
       -> workspace index and global list of named MCP servers
       -> creates a random workspace ID and initializes its ChatRoom

Guest browser -> /w/<workspace-id> (public share link)
  -> Worker routes to ROOMS.getByName(workspace-id)
  -> ChatRoom Durable Object per workspace
       -> workspace metadata, Pi Durable Harness, and one conversation
       -> group messages, agent turns, schedules, follow-ups, and hibernatable WebSocket snapshots
       -> reads the shared MCP server list from DemoAdmin
  -> Workers AI and optional public Streamable HTTP MCP servers
```

- `src/index.ts` — Hono HTTP routing, workspace lookup, WebSocket upgrade proxying, and admin-secret-guarded API.
- `src/admin/demo-admin.ts` — workspace index and up to eight global MCP server configurations in a singleton Durable Object; migrates the previous single-server setting.
- `src/session/chat-room.ts` — one workspace Durable Object; owns that workspace's Harness, conversation, transcript, tasks, alarm lifecycle, hibernatable WebSocket handlers, and Pi Durable broadcast watch.
- `src/session/workspace-info.ts` — workspace ID/title/timestamp stored in the Pi Durable conversation state.
- `src/session/harness.ts` — Workers AI provider, prompt, Pi tools, and durable task registration.
- `src/session/transcript.ts` — projects Pi Durable entries and `pi.live` state into browser snapshots.
- `src/session/schedule-task.ts` and `src/session/schedule-tools.ts` — Pi-native reminder tools and task delivery.
- `src/session/follow-up-classifier.ts` and `src/session/follow-up-task.ts` — classify open turns, cancel stale candidates, and deliver follow-ups.
- `src/integrations/mcp.ts` — public HTTPS Streamable HTTP MCP client.
- `src/ui/` — no-build chat/sidebar/settings UI and the separate admin page, with browser JavaScript.
- `worker-configuration.d.ts` — Wrangler-generated binding types.

### Agent streaming

The workspace Durable Object maintains one Pi Durable conversation watch and broadcasts snapshots over hibernatable WebSockets. Partial assistant text streams in the chat transcript. The browser displays collapsible run/response status and named tool-call events inline with the relevant agent response, not response tokens; users can expand or collapse each activity section. This activity is projected from live progress and is not a second persisted transcript. Idle Durable Objects can hibernate while sockets remain connected; after wake, the constructor rebuilds the Harness watch and broadcasts a current snapshot. The browser reconnects with backoff and retries unacknowledged sends using stable request IDs.

### Automatic follow-up

After a group message, Workers AI reviews the recent conversation for unanswered questions, requests, decisions, and blockers—not just question marks in the newest line. If a useful check-in is warranted, Pi Durable schedules it for a 15-minute quiet period. New group messages reset the review; an agent answer also triggers a fresh review and invalidates stale follow-ups. The follow-up task reads the conversation context before writing its check-in.

### Workspace navigation and settings

The left sidebar lists workspaces visited in the current browser. That guest list is stored locally and is not synced between browsers or devices; the demo has no guest accounts, invitations, or membership system. After an admin enters the secret in **Settings**, the sidebar switches to the global workspace index and exposes delete controls. The Settings panel can create a workspace with an automatic title, copy a public share link, delete a workspace, and manage shared MCP connectors. The secret remains in the tab's `sessionStorage`, never `localStorage`.

### MCP configuration

The Settings panel and legacy `/admin` page can connect up to eight named public HTTPS Streamable HTTP MCP servers, test each endpoint, and discover its tools before saving it globally for all workspaces. Each tool is associated with its server ID, so two servers may advertise the same tool name without ambiguity. Removing a server withdraws its tools from agent use across all workspaces. Guests can see server names and advertised tools, but not endpoint URLs. OAuth, private endpoints, and saved credentials are not supported. The admin secret is required to change these outbound destinations. Existing deployments migrate their previous single MCP URL into the new connector list on first access.

## API

Public, link-based guest routes:

- `GET /w/:workspaceId` — chat UI for a created workspace.
- `GET /api/workspaces/:workspaceId/socket` — hibernatable WebSocket for snapshots and guest sends. Client messages use `{ type: "send", target: "group" | "agent", requestId, authorName, text }`.
- `GET /api/workspaces/:workspaceId/messages` — current transcript.
- `GET /api/workspaces/:workspaceId/mcp` — shared MCP server and tool status.

Admin routes require `Authorization: Bearer <ADMIN_SECRET>`:

- `GET /api/admin/state` — list workspaces and MCP connector statuses.
- `POST /api/admin/workspaces` — create and initialize a named workspace.
- `DELETE /api/admin/workspaces/:workspaceId` — disable the share link and permanently clear the workspace conversation, tasks, and alarm.
- `POST /api/admin/mcp-servers` — validate, discover, and add a named public MCP server.
- `DELETE /api/admin/mcp-servers/:serverId` — remove a shared MCP server.
- `PUT /api/admin/mcp` — legacy compatibility route for older single-server admin clients; current UI uses the multi-server routes.

## Checks

```sh
pnpm check
node scripts/test-browser.mjs
```

Checks cover admin-secret gating, workspace creation/deletion and state, sidebar workspace history, Settings unlock/create/delete and connector configuration, public guest sharing without an ID field, workspace isolation, Hono routing, WebSocket snapshots and sends, idle connection continuity, collapsible inline per-response activity rendering with tool names and statuses, MCP URL validation, multi-server persistence and migration, duplicate tool-name routing, context-aware follow-up classification/task behavior, Wrangler packaging, and desktop/mobile browser layout. Tests use a mocked Workers AI binding; local idle-connection coverage does not prove a production hibernation event. Tests also do not prove live Workers AI, live MCP-server, or wall-clock reminder delivery.

## Deploy with a coding agent

Open this repository in your coding agent, then paste the prompt below. It directs the agent to the root `AGENTS.md`, which is the source of truth for project, security, testing, and deployment rules. The prompt explicitly authorizes deployment to the configured Worker after the account target is verified.

```text
Read the repository-root AGENTS.md completely and follow it. I want you to deploy this project to Cloudflare now.

1. Inspect wrangler.jsonc and scripts/deploy-agent.mjs. Use the Worker name from wrangler.jsonc; do not change deployment targets or bypass the deploy helper.
2. Check git status and preserve all existing user changes. Run `pnpm exec wrangler whoami --json` to verify Cloudflare authentication without printing credentials. If exactly one account is available, use it and state its name/ID and the Worker name. If there are multiple accounts, ask me which one; if none is authenticated, ask me to run Wrangler login. Do not guess.
3. Run pnpm check and node scripts/test-browser.mjs. If either fails, stop and report the failure; do not deploy.
4. This prompt explicitly authorizes deployment to the verified account and configured Worker. After the checks pass, run pnpm deploy:agent --account <ACCOUNT_ID> --name <WORKER_NAME> --yes. Do not reset Durable Object data, change the account/Worker target, or deploy through another path.
5. Never print, copy into chat, commit, or otherwise expose .dev.vars or ADMIN_SECRET. Let the deploy helper manage the local and remote secret.
6. After deployment, verify the chat page, confirm `/admin` is served, and check that an unauthenticated request to `/api/admin/state` is rejected. Report the deployed URL, Worker version ID, checks run, and any live integrations not tested. Do not create a test workspace unless I ask.
7. Do not commit or push unless I separately ask.
```

## Deploy

```sh
pnpm deploy:agent --account ACCOUNT_ID --name WORKER_NAME --yes
```

The helper verifies the Wrangler account, runs checks, deploys, and smoke-checks the chat page. It stores a random admin secret in ignored `.dev.vars` if one is not already there, then uploads it as the Worker secret `ADMIN_SECRET` if the deployed Worker does not already have that secret. Open `<Worker URL>`, select **Settings** at the bottom of the sidebar, and enter the local `.dev.vars` value; `/admin` remains available as a separate admin page. The secret is never printed by the helper.

The prior deployment already retired the old `MultiPersonChat` and `PiSession` classes. This change keeps the deployed `ChatRoom` class and adds `DemoAdmin`; existing ChatRoom data is not migrated or reset by this change.

## Production boundary

There is no guest authentication, workspace membership, or private-room ACL. The share URL grants read/write access. Protect the single admin secret, and rotate it if it is exposed. Up to eight public HTTPS MCP endpoints and their tools are shared with every guest workspace. Add identity, authorization, rate limits, and abuse controls before using this demo for sensitive or production traffic.
