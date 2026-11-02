# Architecture

The demo has one admin/control Durable Object for workspace discovery and global MCP configuration, plus one SQLite-backed `ChatRoom` Durable Object per created workspace. Guest traffic is public and uses the workspace share URL as its bearer link.

## Runtime paths

```text
Admin browser
  -> Worker /admin + /api/admin/*
  -> ADMIN_SECRET checked in the Worker
  -> singleton DemoAdmin Durable Object
       -> workspace index and shared MCP URL
       -> creates a random workspace ID and calls ChatRoom.initializeWorkspace()

Guest browser -> /w/<workspaceId>
  -> Worker /api/workspaces/<workspaceId>/*
  -> ROOMS.getByName(workspaceId)
  -> ChatRoom Durable Object
       -> Pi Durable Harness over this object's SQLite storage
       -> one root conversation plus workspace metadata
       -> chat, agent turns, schedule/follow-up tasks, alarms, SSE watch
       -> reads the global MCP URL from DemoAdmin
  -> Workers AI and optional public MCP server
```

A workspace's random ID maps deterministically to one `ChatRoom`, so its group transcript, agent state, scheduled work, and `WorkspaceInfoDocument` stay together. The singleton `DemoAdmin` contains the index needed to list/create share links and one MCP URL shared across every workspace. It does not hold workspace transcripts or Harness sessions.

## Agent and streaming ownership

Pi Durable and Pi AI own conversation entries, Workers AI turns, tool execution, durable reminder/follow-up tasks, recovery, and live state. `ChatRoom` adapts public chat actions into Pi Durable entries/inputs and projects each watched view into an SSE snapshot. The browser renders partial assistant text and tool calls/results in a collapsible activity panel; the same partial text is also visible in the transcript.

Normal group messages are passive entries; **Ask Agent** submits an input to the same workspace conversation. `schedule`, `list_schedules`, and `cancel_schedule` are Pi tools. Due reminders and proactive follow-ups submit inputs into that conversation. After group messages, Workers AI reviews recent history for unanswered questions, requests, decisions, and blockers. A useful follow-up is scheduled after a 15-minute quiet period. New group messages reset the review; an agent answer invalidates old candidates and triggers a fresh review of the conversation. Durable Object alarms wake the Harness for due tasks.

## Admin and guest access

The admin page at `/admin` sends a bearer `ADMIN_SECRET` header to admin APIs. The secret is held as a Wrangler Worker secret and is never returned by the Worker. The browser keeps the entered secret only for that tab's `sessionStorage` session. Workspace chat APIs intentionally require no auth: possession of the random share URL grants read/write access.

The Worker verifies a workspace ID is in the admin index before serving `/w/:id` or the `/api/workspaces/:id/*` routes. Guests can change their display name; the share URL selects the workspace, with no editable ID field or ID in the chat status. The legacy `/api/rooms/:id/*` routes remain for old query-style demo access. This is a demo gate, not a full account/ACL system.

## Shared MCP

`DemoAdmin` stores one global MCP URL, which all workspace objects read. The admin form validates the destination and discovers its tools before saving it. The initial feature accepts only public HTTPS Streamable HTTP endpoints without OAuth or stored credentials. Guests can see advertised tool names, and the Pi agent can call only a tool discovered from that shared server. Admin-only configuration prevents anonymous users from turning the Worker into an arbitrary outbound request proxy.

## Main files

- `src/index.ts` — routing, workspace lookup, admin secret validation, and streamed HTTP response.
- `src/admin/demo-admin.ts` — global MCP URL and workspace index; creates each workspace DO.
- `src/session/chat-room.ts` — workspace state, Pi Durable conversation, tasks, MCP calls, and SSE watch.
- `src/session/workspace-info.ts` — workspace metadata in Pi Durable state.
- `src/session/harness.ts` — Workers AI model, prompt sections, tools, and durable task registrations.
- `src/session/transcript.ts` — Pi entries/`pi.live` projection and room prompt context.
- `src/session/schedule-task.ts`, `src/session/schedule-tools.ts` — durable reminders.
- `src/session/follow-up-classifier.ts`, `src/session/follow-up-task.ts` — proactive follow-ups.
- `src/integrations/mcp.ts` — public Streamable HTTP MCP client.
- `src/ui/` — no-build guest chat, live activity panel, and secret-gated admin page.
- `worker-configuration.d.ts` — generated Worker binding types.

## Deployment and data

`wrangler.jsonc` keeps `ChatRoom` and adds SQLite-backed `DemoAdmin`. The old `MultiPersonChat` and `PiSession` class deletions were deployed in the preceding refactor. This change does not tombstone or replace `ChatRoom`; workspace metadata is added to its Pi Durable conversation. No deployment data reset is intended.
