# Architecture

The demo has one admin/control Durable Object for workspace discovery and global MCP configuration, plus one SQLite-backed `ChatRoom` Durable Object per created workspace. Guest traffic is public and uses the workspace share URL as its bearer link.

## Runtime paths

```text
Admin browser
  -> Worker /admin + /api/admin/*
  -> ADMIN_SECRET checked in the Worker
  -> singleton DemoAdmin Durable Object
       -> workspace index and shared list of named MCP servers
       -> creates a random workspace ID and calls ChatRoom.initializeWorkspace()

Guest browser -> /w/<workspaceId>
  -> Hono /api/workspaces/<workspaceId>/* route
  -> ROOMS.getByName(workspaceId) (RPC for reads; fetch proxy for WebSocket upgrades)
  -> ChatRoom Durable Object
       -> Pi Durable Harness over this object's SQLite storage
       -> one root conversation plus workspace metadata
       -> chat, agent turns, schedule/follow-up tasks, alarms, hibernatable WebSocket handlers/watch
       -> reads the global MCP server list from DemoAdmin
  -> Workers AI and optional public MCP servers
```

A workspace's random ID maps deterministically to one `ChatRoom`, so its group transcript, agent state, scheduled work, and `WorkspaceInfoDocument` stay together. The singleton `DemoAdmin` contains the index needed to list/create share links and up to eight named MCP server configurations shared across every workspace. It does not hold workspace transcripts or Harness sessions.

## Agent and streaming ownership

Pi Durable and Pi AI own conversation entries, Workers AI turns, tool execution, durable reminder/follow-up tasks, recovery, and live state. Hono routes HTTP requests and forwards the WebSocket upgrade to `ChatRoom.fetch`, where the Durable Object accepts the server socket with the Hibernation API. `ChatRoom` adapts guest commands into Pi Durable entries/inputs and broadcasts snapshots from one conversation watch to every connected guest. Partial assistant text streams in the chat transcript. The browser associates live run/response transitions and named tool-call status events with the corresponding agent response, without duplicating response tokens or creating a second persisted transcript.

When an idle room hibernates, the WebSocket connection remains open but the JavaScript instance and in-memory conversation watch are discarded. On reconstruction, `ChatRoom` reopens its Harness and recreates the watch for sockets returned by `ctx.getWebSockets()`, then sends the latest durable snapshot. The browser also reconnects with exponential backoff and retries unacknowledged sends using the same `requestId`; group writes and agent submissions use that ID for Pi Durable deduplication. No interval heartbeat is used, so it does not keep an idle room awake.

Normal group messages are passive entries; **Ask Agent** submits an input to the same workspace conversation. `schedule`, `list_schedules`, and `cancel_schedule` are Pi tools. Due reminders and proactive follow-ups submit inputs into that conversation. After group messages, Workers AI reviews recent history for unanswered questions, requests, decisions, and blockers. A useful follow-up is scheduled after a 15-minute quiet period. New group messages reset the review; an agent answer invalidates old candidates and triggers a fresh review of the conversation. Durable Object alarms wake the Harness for due tasks.

## Admin and guest access

The admin page at `/admin` sends a bearer `ADMIN_SECRET` header to admin APIs. The secret is held as a Wrangler Worker secret and is never returned by the Worker. The browser keeps the entered secret only for that tab's `sessionStorage` session. Workspace chat APIs intentionally require no auth: possession of the random share URL grants read/write access.

The Worker verifies a workspace ID is active in the admin index before serving `/w/:id` or any workspace API route. Guests can change their display name; the share URL selects the workspace, with no editable ID field or ID in the chat status. Legacy `/api/rooms/:id/*` routes also require an active index entry. This is a demo gate, not a full account/ACL system.

Deleting a workspace first marks its index record as pending deletion, which immediately disables share-link access. `ChatRoom` closes its Pi Durable Harness, cancels its alarm, clears the SQLite storage, and retains only a deletion tombstone so a stale link cannot recreate the conversation. `DemoAdmin` removes the index record after cleanup succeeds; if cleanup fails, the disabled record remains in the admin list with a retry action.

## Shared MCP

`DemoAdmin` stores up to eight named public MCP server configurations, which all workspace objects read. On first access, it migrates the previous single URL from the legacy storage key or `MCP_URL` Worker variable into the new list. Adding a connector validates the public HTTPS URL and discovers its tools before saving. The feature does not support OAuth, private endpoints, or stored credentials. Guests can see server names and tool names, but not endpoint URLs.

Each discovered tool carries its `serverId` and `serverName` in the Pi tool context. The agent's `call_mcp_tool` accepts the server ID, server name, tool name, and arguments; execution revalidates that exact server/tool pair is still configured and advertised before making the outbound call. This permits identical tool names on different servers without routing ambiguity. A failed connector is reported independently, so tools from other working servers remain available. Admin-only connector management prevents anonymous users from turning the Worker into an arbitrary outbound request proxy.

## Main files

- `src/index.ts` — Hono routing, workspace lookup/deletion, admin-secret validation, and WebSocket upgrade proxying.
- `src/admin/demo-admin.ts` — global MCP server list and workspace index; migrates legacy single-server configuration and coordinates workspace deletion.
- `src/session/chat-room.ts` — workspace state, Pi Durable conversation, tasks, MCP calls, hibernatable socket handlers, and the shared snapshot watch.
- `src/session/workspace-info.ts` — workspace metadata in Pi Durable state.
- `src/session/harness.ts` — Workers AI model, prompt sections, tools, and durable task registrations.
- `src/session/transcript.ts` — Pi entries/`pi.live` projection and room prompt context.
- `src/session/schedule-task.ts`, `src/session/schedule-tools.ts` — durable reminders.
- `src/session/follow-up-classifier.ts`, `src/session/follow-up-task.ts` — proactive follow-ups.
- `src/integrations/mcp.ts` — public Streamable HTTP MCP client; `src/session/capability-tools.ts` routes namespaced tool calls to their configured server.
- `src/ui/` — no-build guest chat with inline per-response activity, and secret-gated admin page.
- `worker-configuration.d.ts` — generated Worker binding types.

## Deployment and data

`wrangler.jsonc` keeps `ChatRoom` and adds SQLite-backed `DemoAdmin`. The old `MultiPersonChat` and `PiSession` class deletions were deployed in the preceding refactor. This change does not tombstone or replace `ChatRoom`; workspace metadata is added to its Pi Durable conversation. No deployment data reset is intended.
