# Pi Durable migration notes

This project should use Pi Durable and Pi AI as the actual agent runtime, following both the [Pi Durable on Cloudflare article](https://earendil.com/posts/pi-durable-on-cloudflare/) and the local `pi-durable-chat` reference project. The objective is to simplify the codebase without losing product behavior.

## Decision

Keep product-specific chat app state in this starter, and use `@earendil-works/pi-durable` and `@earendil-works/pi-ai` as the actual agent runtime. Preserve existing product behavior behind narrow adapters while migrating.

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
| direct provider calls and hand-written Anthropic tool loop | Replaced for Ask Agent by Pi Durable `Harness`, Pi AI Workers AI/Anthropic providers, and registered Pi schedule tools |
| group-message table and HTTP transcript shape | Kept as app-owned group chat product state; agent turns, tool events, and scheduled inputs/results are Pi Durable entries projected through the HTTP adapter |
| Calendar schedules and `create_schedule` path | Pi Durable task-backed Calendar plus native `schedule`, `list_schedules`, and `cancel_schedule` tools; due tasks submit to the Pi room conversation |
| `src/durable/features/follow-ups.ts` custom alarm loop | Still custom; migrate its durable work to Pi tasks while preserving its current classification/resolution behavior |
| connector tool calls through direct admin API | Still app-owned settings/admin operations; expose selected connector tools through Pi only after preserving existing authorization and OAuth behavior |
| skill catalog and prompt context | Catalog remains app-owned; prompt context is now delivered to Pi sections. Skill execution tools remain future work |

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

1. Add Pi Durable dependencies, `agents` Workers AI bridge, and architecture guardrails. Done.
2. Route Ask Agent through a room-scoped Pi Durable `Harness`; Pi AI now selects the configured Workers AI or Anthropic provider. Done in `src/session/pi-session.ts` and `src/session/harness.ts`.
3. Register Pi-native `schedule`, `list_schedules`, and `cancel_schedule` tools; make Pi scheduled tasks submit due instructions to their room conversation and wake via Durable Object alarms. Implemented; end-to-end live-provider delivery still needs a manual smoke test.
4. Project Pi assistant entries and scheduled reminder inputs into the existing simple HTTP/UI transcript shape while retaining the app-owned group-message catalog. Done.
5. Migrate proactive follow-ups to Pi tasks without changing their classification, resolution, or retry behavior. Not done.
6. Expose existing app-managed connector and skill capabilities as Pi tools with their current authorization rules. Not done.
7. Remove the remaining custom agent-runtime/follow-up code only after behavior and migration tests demonstrate parity.

## Current Pi Durable probe

Each room's `PiSession` uses Pi Durable and Pi AI for Ask Agent turns, provider selection, model tool execution, transcript/event history, and schedule tasks. Calendar and the native `schedule`, `list_schedules`, and `cancel_schedule` tools share those tasks. At the deadline, a task submits its instruction into that room's Pi conversation; the HTTP adapter projects Pi assistant replies and scheduled inputs into the current transcript API. The app's member/room/group-message catalog remains in `CHAT`. Proactive follow-ups, connector tool exposure, and skill execution still need migration. Code-level tests pass, but a live provider-backed Ask Agent and timed-delivery smoke test was not run in this environment.
