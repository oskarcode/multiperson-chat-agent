# MultiPerson Chat with Agent

A small, public group-chat demo for Cloudflare Workers. People who use the same room ID share a chat; each room has its own SQLite-backed Durable Object and Pi Durable conversation. Send messages to the room, ask the agent for help, watch its progress stream into the browser, and let it schedule reminders or follow-ups.

This is a learning/demo starter, not an authenticated chat product. Anyone who knows a room ID can read and post in that room. Add your own authentication and authorization layer before using it for private conversations.

## Demo flow

1. Open the Worker URL, choose a display name, and use a room ID such as `lobby`.
2. Share the same room ID with other people to chat together. Choose another ID to start a separate room/session.
3. Use **Send to group** for a normal message or **Ask Agent** to submit a question to the room's Pi Durable conversation.
4. Watch the agent's partial answer and tool progress arrive over the live room stream.
5. Ask the agent to schedule a reminder. Pi Durable stores the task, and the room Durable Object wakes when it is due.
6. Optionally configure a public MCP server with `MCP_URL`; the agent can discover and call its tools.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler dev
```

The Workers AI binding is configured in `wrangler.jsonc`. The default model is `@cf/zai-org/glm-4.7-flash`. Agent requests made during local development still call Workers AI remotely and may incur usage charges; authenticate Wrangler with an account that can use Workers AI. To test a public, unauthenticated Streamable HTTP MCP server, set `MCP_URL` in `wrangler.jsonc` to its HTTPS endpoint. The UI will show the tools advertised by that server. MCP OAuth is not included.

## How it works

```text
Browser
  -> Worker routes and serves the no-build UI
  -> ROOMS.getByName(roomId)
  -> one ChatRoom Durable Object per room
       -> Pi Durable Harness and one room conversation
       -> chat entries, agent entries, live partials, reminders, follow-ups
       -> Durable Object alarm wakes Pi Durable tasks
       -> optional MCP client calls the configured public server
  -> Workers AI
```

- `src/index.ts` — small Worker router for the page and room API.
- `src/session/chat-room.ts` — room Durable Object; owns the Pi Durable Harness, room chat, MCP capability, follow-up monitor, and alarm entrypoint.
- `src/session/harness.ts` — Workers AI provider, prompt sections, Pi tools, and task registration.
- `src/session/transcript.ts` — projects Pi Durable entries and live generation/tool state into a browser snapshot.
- `src/session/schedule-task.ts` and `src/session/schedule-tools.ts` — Pi Durable reminder task plus schedule/list/cancel tools.
- `src/session/follow-up-classifier.ts` and `src/session/follow-up-task.ts` — classify open group-chat turns, schedule a follow-up, and submit it to the same conversation. A newer group message makes older candidates stale.
- `src/session/capability-tools.ts` and `src/integrations/mcp.ts` — agent tool for the configured MCP server and its Streamable HTTP client.
- `src/ui/` — plain HTML, CSS, and browser JavaScript; no frontend build step.
- `worker-configuration.d.ts` — Wrangler-generated binding types.

### Streaming

The room Durable Object watches the Pi Durable conversation and returns SSE snapshots. Each snapshot contains the visible transcript and current Pi `pi.live` state. The browser renders partial assistant text and tool activity; a reconnect starts from the current snapshot.

### Scheduling and automatic follow-up

The `schedule`, `list_schedules`, and `cancel_schedule` Pi tools create and manage Pi Durable tasks. A due reminder submits a new input to the room conversation; it is not a separate reply loop. The follow-up monitor observes group messages, classifies whether an open turn needs a later check-in, and schedules a Pi Durable task. New messages invalidate stale candidates. Durable Object alarms wake the room to run due tasks.

## API

- `GET /api/rooms/:roomId/messages` — current projected transcript.
- `GET /api/rooms/:roomId/events` — SSE transcript and agent progress stream.
- `POST /api/rooms/:roomId/messages` — send a group message or queue an agent request (`target: "agent"`).
- `GET /api/rooms/:roomId/mcp` — discover tools from the configured MCP endpoint.

## Checks

```sh
pnpm check
node scripts/test-browser.mjs
```

`pnpm check` verifies generated types, TypeScript, unit tests, Wrangler packaging, room behavior, and the deploy helper. The browser test covers shared rooms, room isolation, live updates, and the mobile layout. Mocked tests do not prove that a real Workers AI model or public MCP server is reachable; test those integrations separately before relying on them.

## Deploy

After approving the account and Worker name, use:

```sh
pnpm deploy:agent --account ACCOUNT_ID --name WORKER_NAME --yes
```

The helper verifies the selected Wrangler account, runs `pnpm check`, deploys, and checks the chat page. It does not create an application secret because this demo has no sign-in flow.

**Storage note:** `wrangler.jsonc` retires the old `MultiPersonChat` and `PiSession` classes and declares the new `ChatRoom` class. Deploying this configuration permanently deletes the old Durable Object namespaces and their data. This is intentional for this demo refactor; do not reuse the old classes' data.

## Production boundary

This demo has no app authentication, memberships, private rooms, rate limiting, or full abuse controls. Room IDs are public names, not access tokens. `MCP_URL` is set by the Worker owner rather than entered by anonymous visitors, and the starter expects a public HTTPS MCP endpoint. Do not use the deployed demo for private or sensitive conversations without adding your own identity, authorization, and abuse-control layer.
