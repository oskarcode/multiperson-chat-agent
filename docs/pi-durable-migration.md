# Pi Durable migration notes

This project should use Pi Durable and Pi AI as the actual agent runtime, following both the [Pi Durable on Cloudflare article](https://earendil.com/posts/pi-durable-on-cloudflare/) and the local `pi-durable-chat` reference project. The objective is to simplify the codebase without losing product behavior.

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

## Feature-preserving migration rule

Do not remove a feature while replacing its implementation until its Pi-native path passes behavior tests. Keep compatibility adapters narrow and temporary. In particular, a task that sleeps until its deadline and then completes without submitting work is not scheduled delivery and must not be reported as a working reminder.

## Current overlap to migrate

| Current file/feature | Replacement direction |
|---|---|
| `src/agent/reply.ts` direct provider calls and hand-written Anthropic tool loop | Pi Durable `Harness` with `pi-ai` provider and registered Pi tools; not migrated |
| `src/durable/features/messages.ts` message table | Pi Durable entries/conversations, projected through an adapter to preserve the current API/UI; not migrated |
| Pi Durable task-backed Calendar routes and `create_schedule` Anthropic tool | Pi Durable task storage exists, but scheduled tasks currently only wait and complete; they do not deliver. Replace the custom Anthropic tool loop with registered Pi tools and make task delivery submit to the Pi conversation |
| `src/durable/features/follow-ups.ts` custom alarm loop | Pi Durable tasks plus app follow-up policy; not migrated |
| connector tool calls through direct admin API | registered Pi Durable tools with tool diagnostics/progress; not migrated |
| skill prompt text table | Pi Durable prompt sections/tools, keeping app-specific skill catalog as needed; not migrated |

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
4. Port/adapt remaining schedule list/cancel tools from FamilyChat. Claude schedule creation already comes from a tool call, not text parsing.
5. Project Pi Durable entries back into the existing simple UI transcript shape.
6. Replace or remove the custom message/follow-up stores once compatibility tests pass.

## Current Pi Durable probe

The starter includes a `PiSession` Durable Object backed by `@earendil-works/pi-durable` and SQLite storage. Settings → Calendar creates/lists/cancels Pi Durable tasks in a room-scoped session, and the direct Anthropic API path can call `create_schedule`. However, those tasks currently wait until their deadline and then complete without submitting a reminder or starting agent work. Public chat transcripts and agent generation still use the legacy `CHAT` / direct-provider path. Therefore end-to-end Pi-native agent turns and scheduled delivery are not complete yet.
