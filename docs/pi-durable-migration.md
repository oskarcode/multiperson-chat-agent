# Pi Durable migration notes

This project should use Pi Durable for agent runtime behavior instead of growing a second custom mini-agent framework.

## Decision

Keep product-specific chat app state in this starter, but move agent/conversation/tool/task features toward `@earendil-works/pi-durable` and `@earendil-works/pi-ai`.

## Keep custom here

These are product/application concerns and can remain direct code in this repository:

- first owner setup
- guest invite links
- member roles and room membership
- workspace catalog
- Hono HTTP routes
- deployment helper
- simple no-build starter UI

## Prefer Pi Durable for these

Do not add new manual implementations for these areas unless they are explicitly temporary compatibility layers:

- agent conversation/session runtime
- transcript entries and durable event history
- model/tool execution loop
- schedule/list/cancel tools
- durable scheduled tasks and task recovery
- tool progress, diagnostics, and nested calls
- background agent work
- conversation search/inbox semantics

## Current overlap to migrate

| Current file/feature | Replacement direction |
|---|---|
| `src/agent/reply.ts` direct model calls | Pi Durable `Harness` with `pi-ai` provider |
| `src/durable/features/messages.ts` message table | Pi Durable entries/conversations |
| `src/durable/features/schedules.ts` schedule table | Started replacement with Pi Durable task-backed Calendar routes in `src/session/schedule-task.ts`; next step is model-callable schedule/list/cancel tools patterned after FamilyChat |
| `src/durable/features/follow-ups.ts` custom alarm loop | Pi Durable tasks plus app follow-up policy |
| connector tool calls through direct admin API | registered Pi Durable tools with tool diagnostics/progress |
| skill prompt text table | Pi Durable prompt sections/tools, keeping app-specific skill catalog as needed |

## Reference implementation

Use the local FamilyChat/Pi Durable project as the source of truth for patterns:

```text
/Users/oskarablimit/Desktop/Clouddlare SE/Demos (frequently used)/pi-durable-chat
```

Especially:

```text
src/chat/chat.ts
src/chat/session-runtime.ts
src/worker/session.ts
src/scheduling/tools.ts
src/scheduling/schedule.ts
src/protocol/schedules.ts
```

## Migration sequence

1. Add Pi Durable dependencies and record the architectural rule. Done.
2. Introduce a Pi Durable session Durable Object for one room while keeping the public HTTP API stable. Started with `src/session/pi-session.ts` and the `SESSIONS` Durable Object binding.
3. Route new Agent requests through a Pi Durable `Harness` instead of `src/agent/reply.ts` direct provider calls.
4. Port/adapt schedule/list/cancel tools from FamilyChat so schedule creation comes from tool calls, not text parsing. Calendar CRUD now uses Pi Durable tasks as a stepping stone.
5. Project Pi Durable entries back into the existing simple UI transcript shape.
6. Replace or remove the custom schedule/message/follow-up stores once compatibility tests pass.

## Current explicit guardrail

Until schedule tools are wired in, the prompt in `src/agent/reply.ts` tells the agent not to claim that it created a schedule. This avoids false Calendar confirmations while preserving the goal of implementing proper Pi Durable-backed schedule tools next.

## Current Pi Durable probe

The starter now includes a `PiSession` Durable Object backed by `@earendil-works/pi-durable` and SQLite storage. Admins can call `GET /api/pi/status` to verify that the session opens and creates a Pi Durable root conversation. Settings → Calendar creates/list/deletes Pi Durable scheduled tasks through `PiSession`; public chat traffic and model-issued schedule tools have not been moved to this session yet.
