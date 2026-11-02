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
| `src/durable/features/follow-ups.ts` custom alarm loop | New classifications use Pi AI; new waiting/cancellation/delivery use Pi Durable tasks. The legacy SQL alarm remains only to transfer pending records created by older deployments. |
| connector tool calls through direct admin API | MCP metadata, OAuth, and role checks remain app-owned; the Pi `call_connector_tool` tool invokes only cached tools and still passes through the owner/admin authorization. |
| skill catalog and prompt context | Catalog and editing remain app-owned; enabled skill instructions are discoverable through the Pi `read_skill_file` tool. |

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
5. Move new proactive follow-up classification to Pi AI and waiting/resolution/delivery to Pi Durable tasks. Implemented and tested; the legacy alarm path remains only to drain pre-migration rows.
6. Expose connector calls and enabled skill-file reads as Pi tools. Implemented; connector execution still enforces the existing owner/admin rule in app code.
7. Remove the legacy follow-up table/alarm after pending rows have been transferred and verified; keep auth, connector/OAuth persistence, and skill editing app-owned.

## Current Pi Durable probe

Each room's `PiSession` uses Pi Durable and Pi AI for Ask Agent turns, provider selection, model tool execution, transcript/event history, Calendar reminders, and proactive follow-ups. Native schedule tools, MCP connector calls, and enabled skill-file reads are registered in the Harness; connector and skill APIs retain app-owned authorization and persistence. Due reminders and follow-ups submit inputs to the room conversation. The app's member/room/group-message catalog remains in `CHAT`. Only pre-migration follow-up rows still use the legacy alarm as a transfer path. Code-level tests cover the Pi model loop and task delivery; a live provider-backed Ask Agent and timed-delivery smoke test was not run in this environment.
