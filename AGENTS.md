# MultiPerson Chat demo: project instructions

This repository is a beginner-friendly Cloudflare Workers demo, not a production chat product. Keep the explanation and code path small.

## Demo contract

- One Worker serves the no-build chat/sidebar/settings UI, separate admin UI, and APIs.
- Admin operations require the Worker secret `ADMIN_SECRET`; guests do not authenticate. A guest share URL is a bearer link that grants read/write access to that workspace. The chat sidebar may remember opened share links in browser-local storage, but that list is not identity, membership, or authorization.
- `DemoAdmin` is a singleton Durable Object for the workspace index and up to eight named, globally shared MCP endpoints. Do not put chat transcripts or Pi sessions in it.
- Guests join from `/w/<id>` share links; show only their editable display name in the guest UI, never an editable workspace-ID field or the ID in chat status. Show the browser's visited-workspace list in the sidebar; after admin-secret entry in Settings, show the global workspace list and admin-only delete controls. Guest list data is device-local and must not be described as an account or invitation list.
- Each created workspace ID maps to one SQLite-backed `ChatRoom` Durable Object. That object owns workspace metadata, the room transcript, and its independent Pi Durable Harness/conversation.
- Admin deletion must disable the workspace in the global index before cleanup, close the Pi Durable Harness, cancel alarms, clear the room's SQLite data, and retain only a deletion tombstone so stale links cannot recreate it. Keep failed cleanup retryable from the admin list.
- Group messages, Ask Agent requests, assistant replies, reminders, and progress are stored/projected from Pi Durable. Do not add a second transcript store.
- Pi Durable/Pi AI owns model turns, tool execution, durable reminder/follow-up tasks, recovery, and authoritative conversation history. Workers AI is the only model provider.
- The browser uses a hibernatable Durable Object WebSocket for guest sends and committed Pi Durable conversation snapshots. Keep streamed partial assistant text in the chat transcript; render collapsible live activity and tool-call names/statuses inline with the relevant agent response, never duplicate response tokens. Activity is a client-side projection of live progress, not a second persisted transcript. Rebuild in-memory watches after hibernation, send a current snapshot on reconnect, and keep idle sockets free of heartbeat timers.
- Up to eight named public HTTPS Streamable HTTP MCP endpoints are configured by the admin and shared by all workspaces. Keep tool discovery and invocation, but do not let guests choose outbound URLs. OAuth, private MCP endpoints, and stored credentials are out of scope.
- There are no guest accounts, workspace ACLs, memberships, invite/role systems, Anthropic credentials, model settings, skills management, or schedule calendar. Make these limits clear.

## Keep the code easy to teach

- Use Hono for the small Worker HTTP route table and WebSocket upgrade dispatch; keep the hibernatable socket lifecycle inside `ChatRoom` and use typed Durable Object RPC for non-upgrade operations. Do not duplicate RPC interfaces.
- Keep one obvious state owner per domain: `DemoAdmin` for the small global workspace/MCP index, `ChatRoom` for each workspace's application state and Pi Durable session.
- Use Pi Durable primitives for agent, task, transcript, and progress behavior. Do not implement a custom agent loop or custom event-diff protocol.
- Follow-up review should examine recent conversation context for unresolved requests, questions, decisions, and blockers. Use the 15-minute quiet-period debounce; new group messages and completed agent replies must invalidate/review stale candidates.
- Validate workspace IDs and MCP URLs. Admin endpoints must fail closed without `ADMIN_SECRET`; never put it in Wrangler `vars`, logs, URLs, or browser localStorage.
- Keep admin secret values only in ignored `.dev.vars` locally, Wrangler secrets remotely, and the current browser tab's `sessionStorage` after intentional admin entry. Never put the secret in `localStorage`, print it, or commit it.
- Update `README.md` and `docs/architecture.md` with architecture behavior in the same change.

## Storage and deployment changes

- Existing `ChatRoom` Durable Object state must be preserved when adding workspace metadata. Do not rename/tombstone this class or reset its namespace.
- The previous refactor already retired `MultiPersonChat` and `PiSession`; those old namespaces/data were deleted on deployment.
- Do not deploy, publish, or reset remote resources unless the user explicitly asks. An explicit deploy request authorizes only the named Worker/account deployment; preserve the deploy helper's target guard.
- `MCP_URL`, `AI_MODEL`, and `AI_GATEWAY_ID` are non-secret Worker vars. `MCP_URL` is retained as the legacy first-run seed for the multi-server list. Do not add provider credentials to source/config.
- `worker-configuration.d.ts` is generated by Wrangler. After changing bindings/vars, run `pnpm types`; `pnpm check` verifies it is current.
- Preserve the deploy helper's explicit account, Worker name, and `--yes` target guard. It may provision the random `ADMIN_SECRET` from ignored `.dev.vars`; never emit the value.

## Verification

Run `pnpm check` and `node scripts/test-browser.mjs` (or `pnpm test:browser`) after changes. Cover:

- admin-secret protection, workspace creation/index/share URL, public guest joins, and workspace isolation;
- Pi Durable agent turns, streamed transcript text, inline per-response activity updates, and MCP tool registration;
- scheduled reminder delivery, automatic follow-up/stale candidates, and global MCP validation/configuration.

Report mocked tests separately from live Workers AI, timed delivery, and public MCP tests. Do not claim live integrations were tested unless they were.
