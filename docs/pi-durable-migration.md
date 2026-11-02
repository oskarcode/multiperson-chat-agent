# Pi Durable workspace behavior

Each shareable workspace maps to one `ChatRoom` Durable Object. That object owns the workspace's Pi Durable Harness, root conversation, metadata, transcript, scheduled tasks, and live stream. The separate `DemoAdmin` object stores the workspace index and one global MCP URL; it does not hold chat sessions.

## Agent and transcript

Pi Durable and Pi AI own conversation entries, Workers AI turns, tool execution, task recovery, and live snapshots. Group posts are passive entries; Ask Agent, reminders, and follow-ups submit inputs to the same workspace conversation. The browser receives SSE snapshots containing committed transcript entries and `pi.live` partial/tool state. Guest UI exposes the display-name field only; the share link selects the workspace.

## Scheduled work

A reminder is a Pi Durable task, not a separate app calendar. When due, it submits an instruction to the workspace root conversation. A Durable Object alarm wakes the Harness, and the assistant response appears in the same transcript and activity stream.

## Conversation-aware follow-up

After each group message, Workers AI reviews recent chat chronology for open questions, requests, decisions, promised actions, and blockers. It should consider later replies and not treat a question mark alone as sufficient. If a check-in would help, Pi Durable schedules it after a 15-minute quiet period. New group messages reset the review; an Ask Agent turn cancels old candidates and triggers a new review after the agent responds. The task submits its check-in to the same conversation. Live timed delivery still needs a deployed smoke test.

## Shared MCP

An admin connects one public HTTPS Streamable HTTP server. `DemoAdmin` stores the endpoint globally for all workspaces. The admin form discovers tools before saving; each workspace agent can call only an advertised tool. OAuth, private MCP endpoints, and stored credentials are out of scope.

## Access boundary

Guests do not sign in: anyone with the random workspace link can read and post. The `/admin` UI requires the Worker secret `ADMIN_SECRET`. This is a demo-level admin gate, not a guest identity/ACL system. Keep the secret out of chat, URLs, source, and logs.

## Verification boundary

Local tests cover Pi Durable turns/tasks, follow-up classification and stale-candidate behavior, workspace isolation, admin gating, SSE, and browser rendering. They do not prove live Workers AI inference, a real MCP server connection, or wall-clock follow-up delivery.
