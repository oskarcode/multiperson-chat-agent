# Pi Durable demo architecture

The room's Pi Durable conversation is both its agent session and its transcript source. Every room ID maps to one `ChatRoom` Durable Object, which hosts the Harness over SQLite storage owned by that object.

## Responsibilities

Pi Durable and Pi AI own:

- conversation entries and agent turns;
- Workers AI model execution and the tool loop;
- `schedule`, `list_schedules`, `cancel_schedule`, and MCP call tools;
- durable reminder and proactive follow-up tasks;
- retries, task recovery, and progress snapshots;
- the conversation watch used by the browser's SSE stream.

The application adapter owns only the demo interface around that runtime:

- accept a room ID, display name, and message;
- write normal group chat as passive Pi Durable entries;
- project conversation entries and `pi.live` into a compact browser snapshot;
- provide optional Worker-owner-configured MCP server details.

## Scheduled work

A reminder is a Pi Durable task, not a timestamp stored in a separate app calendar. When due, the task submits an instruction to the room's root conversation. The Durable Object alarm wakes the Harness, and the resulting assistant response appears in the same transcript and live stream.

## Automatic follow-up

After a group message, the room monitor classifies whether an unresolved turn merits a later check-in. A positive result creates a durable Pi task with the current room revision. A newer group message advances that revision; stale tasks do not deliver. The task submits a follow-up input to the same Pi conversation after its delay. Real timed delivery still needs a live smoke test with Workers AI.

## MCP

The optional Worker variable `MCP_URL` points to one public, unauthenticated Streamable HTTP server. The Harness registers `call_mcp_tool`; the tool checks the server's advertised tool list before invoking it. OAuth, user-managed connectors, and app-level connector settings are out of scope for this starter.

## Removed from the former product implementation

The demo no longer includes app sign-in, roles, invites, private-room membership/catalog, AI provider settings, Anthropic credentials, skills, connector OAuth management, a schedule calendar, or the old global `MultiPersonChat` state owner. The Worker provides no app authentication: room IDs are public names. Users who need private access must add their own authentication and authorization.

The old `MultiPersonChat` and `PiSession` Durable Object namespaces are tombstoned in `wrangler.jsonc`. Deploying the new `ChatRoom` class deletes those old namespaces and their data; preservation was explicitly waived. The refactor was not remotely deployed.

## Verification boundary

Local tests cover Pi Durable turns, tool registration, task delivery/stale follow-up behavior, streamed partial snapshots, Worker room isolation, SSE delivery, and the browser's shared-room flow. They do not establish that a live Workers AI model, a real public MCP server, or a 30-minute live follow-up works in a deployed environment. Run those smoke tests against a disposable public demo configuration before making external-integration claims.
