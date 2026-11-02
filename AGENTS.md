# MultiPerson Chat with Agent: deployment runbook

This file tells coding agents how to deploy this repository safely.

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
