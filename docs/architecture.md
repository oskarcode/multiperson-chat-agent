# Architecture

This demo keeps the request path short: one Worker, one room Durable Object per room ID, and one Pi Durable conversation in each room.

## Runtime path

```text
Browser
  -> src/index.ts (native Worker router and static page)
  -> env.ROOMS.getByName(roomId)
  -> ChatRoom Durable Object
       -> Pi Durable Harness over this object's SQLite storage
       -> one root conversation for the room
       -> Pi-native schedule and follow-up tasks
       -> optional configured MCP client
  -> Workers AI
```

The same room ID always maps to the same `ChatRoom` Durable Object. People who share the ID share the chat and agent conversation; a different ID gives them a separate room/session. There is no global room catalog or second transcript database.

## State and agent ownership

Pi Durable is the source of truth for the room transcript and agent runtime:

- Normal group messages are passive application entries in the room conversation; they do not trigger a model turn.
- **Ask Agent** submits a Pi Durable input. Pi AI invokes the configured Workers AI model and Pi Durable owns tools, retries, and the final assistant entry.
- Scheduled reminders and proactive follow-ups are durable Pi tasks. When due, each submits an instruction to the same conversation.
- A newer group message advances the follow-up cursor, making an older candidate stale. Durable Object alarms wake the room to run due Pi tasks.
- The UI watches committed Pi Durable conversation snapshots. Partial assistant text and tool execution state come from `pi.live` and are forwarded to the browser over SSE.

`ChatRoom` owns the room lifecycle and adapts application actions to the Harness. It does not implement a second agent loop, message table, schedule engine, or progress-diff protocol.

## MCP

The optional MCP server is configured by the Worker owner using `MCP_URL`. The room exposes its discovered tool names to the prompt and registers one Pi tool, `call_mcp_tool`, which only calls a tool advertised by that server. The initial demo supports public HTTPS Streamable HTTP servers without OAuth. There is no public UI for choosing an arbitrary URL: room IDs and messages are public, so exposing URL configuration to visitors would also expose outbound network calls.

## HTTP and UI

`src/index.ts` has four concerns only:

1. Serve the no-build HTML page.
2. Route room message reads/writes to the named Durable Object.
3. Return its live conversation watch as an SSE response.
4. Report MCP tools configured for the Worker.

The browser stores a display name and selected room ID locally. It opens one `EventSource` per room and renders transcript snapshots, partial responses, and tool activity. There is no login, member catalog, invite system, settings panel, or frontend framework.

## Durable Object lifecycle

`wrangler.jsonc` binds `ROOMS` to `ChatRoom` and declares SQLite storage. `worker-configuration.d.ts` is generated from that config by Wrangler. Each room instance opens Pi Durable storage from its Durable Object SQLite storage, resumes tasks, and sets the next alarm from pending reminder/follow-up deadlines.

The config tombstones the old `MultiPersonChat` and `PiSession` classes. Deploying this change deletes their namespaces and data; the demo owner confirmed that data preservation is not needed. No remote deployment was run as part of the refactor/commit.

## Main files

- `src/index.ts` — Worker routing and page response.
- `src/session/chat-room.ts` — one room/session Durable Object; messages, room context, Pi task lifecycle, alarms, and the stream adapter.
- `src/session/harness.ts` — Pi AI Workers AI provider, prompt, tools, and task registration.
- `src/session/transcript.ts` — Pi entries/live state to browser snapshot projection and model room context.
- `src/session/schedule-task.ts` and `src/session/schedule-tools.ts` — durable reminder delivery and agent tools.
- `src/session/follow-up-classifier.ts` and `src/session/follow-up-task.ts` — candidate classification, stale detection, and durable delivery.
- `src/session/capability-tools.ts` and `src/integrations/mcp.ts` — MCP Pi tool and protocol client.
- `src/ui/` — page markup, styles, and browser client.
- `worker-configuration.d.ts` — generated Worker binding types.
