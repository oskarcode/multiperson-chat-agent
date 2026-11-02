# MultiPerson Chat with Agent: deployment runbook

This file tells coding agents how to deploy this repository safely and how to preserve the intended architecture.

## Architecture requirement: prefer Pi Durable primitives

This starter is intended to use Pi Durable and Pi AI as its actual agent runtime, following both the Pi Durable on Cloudflare article and the current `pi-durable-chat` reference implementation. Before adding custom agent, scheduling, tool, transcript, background-task, or recovery behavior, check whether `@earendil-works/pi-durable`, `@earendil-works/pi-ai`, or the references already provide the primitive.

Do not add manual replacements for features that should be backed by Pi Durable, especially:

- ad-hoc natural-language schedule parsing
- custom agent tool loops
- custom durable task queues
- custom conversation transcript/event systems
- custom schedule execution/retry logic
- custom tool diagnostics/progress systems

Non-negotiable goal:

- Pi Durable/Pi AI must own the real agent runtime: model execution, tool loop, conversations/transcript/event history, durable background work, scheduled delivery, retries/recovery, and diagnostics wherever the libraries provide those capabilities.
- Keep app-specific product features: member authentication, invites, roles, private room/workspace catalog and access rules, onboarding, connectors/skills, Calendar UI, and existing chat behavior.
- Preserve feature parity during migration. Keep old and new implementations side by side only as a temporary compatibility bridge with an explicit removal condition; do not expand the legacy path.
- Do not describe a Pi task as a working reminder unless it actually submits the scheduled instruction to the Pi conversation and its execution is observable. A task that only sleeps and completes is not delivery.
- Before removing any legacy behavior, map its current feature/security behavior to the Pi-native replacement and add compatibility tests. After parity passes, delete the replaced custom implementation rather than maintaining two runtimes.
- Report the migration state accurately. Passing typecheck/deploy smoke tests does not prove model tool calls, scheduled delivery, or end-to-end feature parity.

Primary architecture article:

```text
https://earendil.com/posts/pi-durable-on-cloudflare/
```

Reference project for the concrete implementation pattern:

```text
/Users/oskarablimit/Desktop/Clouddlare SE/Demos (frequently used)/pi-durable-chat
```

Relevant reference files:

```text
src/chat/chat.ts
src/chat/session-runtime.ts
src/worker/session.ts
src/scheduling/tools.ts
src/scheduling/schedule.ts
src/protocol/schedules.ts
```

## 0. Verify the project

Before installing or deploying, verify that you are in the intended clone:

```sh
git remote get-url origin
node -e "const p=require('./package.json'); if(p.name!=='multiperson-chat-agent'||p.scripts['deploy:agent']!=='node scripts/deploy-agent.mjs') process.exit(1)"
```

Confirm that `git remote get-url origin` is the repository URL the user intended to deploy. If the package check fails, stop and ask for clarification.

## 1. Prepare once

Read this file and `wrangler.jsonc`. Check Node/pnpm, then run:

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler whoami --json
```

If Wrangler is not authenticated, run:

```sh
pnpm exec wrangler login
```

Let the account owner complete browser login. Never request or print raw tokens in chat. Never copy `.env`, `.dev.vars`, `.wrangler/`, or secrets from another project.

## 2. Confirm target once

Ask for one confirmation that includes:

- Cloudflare account name/ID
- Worker name
- create vs update intent

Use a new Worker name for a fresh install. Do not edit `wrangler.jsonc` just to rename a deployment.

## 3. Deploy with the helper

After approval, run exactly:

```sh
pnpm deploy:agent --account ACCOUNT_ID --name WORKER_NAME --yes
```

The helper:

- verifies Wrangler authentication and selected account
- runs `pnpm check`
- creates `SESSION_SECRET` for new Workers
- preserves existing secrets on updates
- deploys with Wrangler
- smoke-checks `/api/me`

Do not separately upload secrets or run raw deploy commands unless debugging a helper failure.

## 4. Handoff

Return:

- Worker URL
- account and Worker name
- whether checks passed
- smoke-check result

The owner opens the Worker URL and creates the first owner account in the app.

## Stop conditions

Stop and report the exact blocker if:

- Wrangler authentication or account access fails.
- The Worker name points to a deployment the user did not approve.
- An existing Worker is missing `SESSION_SECRET` and would require manual recovery.
- `pnpm check` fails.
- Cloudflare API lookups fail.
- The workers.dev subdomain is not enabled.

Do not reset production data, rotate existing secrets, or touch unrelated Cloudflare resources without explicit approval.
