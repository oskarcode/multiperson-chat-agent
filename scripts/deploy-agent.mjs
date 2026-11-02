#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ensureLocalAdminSecret } from './admin-secret.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function deploy() {
  const args = process.argv.slice(2).filter(a => a !== '--');
  const usage = 'Usage: pnpm deploy:agent --account ACCOUNT_ID --name WORKER --yes (only after owner approval)';
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--yes') options[arg] = true;
    else if (['--account', '--name'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) options[arg] = args[++i];
    else throw new Error(usage);
  }
  if (!options['--account'] || !options['--name'] || !options['--yes']) throw new Error(usage);
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const name = options['--name'];
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)) throw new Error('Invalid Worker name.');

  let environment = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
  const run = (commandArgs, capture = false, input) => {
    const result = spawnSync('pnpm', commandArgs, {
      encoding: 'utf8', env: environment,
      stdio: capture || input !== undefined ? 'pipe' : 'inherit',
      ...(input === undefined ? {} : { input }),
    });
    if (result.error || result.status !== 0) throw new Error(`Command failed: pnpm ${commandArgs.join(' ')}`);
    return result.stdout || '';
  };
  const wrangler = (commandArgs, capture = false, input) => run(['exec', 'wrangler', ...commandArgs], capture, input);
  let identity;
  try { identity = JSON.parse(wrangler(['whoami', '--json'], true)); }
  catch { throw new Error('Unable to verify Cloudflare authentication. Run wrangler login with the owner, then retry.'); }
  const accounts = identity.accounts || [];
  const account = options['--account'];
  const selected = accounts.find(a => a.id === account);
  if (!selected) throw new Error('Select an account returned by Wrangler whoami.');
  if (config.account_id && config.account_id !== account) throw new Error('Configured account differs from the approved account. Stop and review the target.');
  environment = { ...environment, CLOUDFLARE_ACCOUNT_ID: account };

  // Wrangler holds the credential; keep it in memory and use it only to look up the workers.dev subdomain.
  const credential = JSON.parse(wrangler(['auth', 'token', '--json'], true));
  const headers = credential.type === 'api_key'
    ? { 'X-Auth-Key': credential.key, 'X-Auth-Email': credential.email }
    : { Authorization: `Bearer ${credential.token}` };
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/subdomain`, { headers });
  const data = await response.json();
  if (!response.ok || !data.success || !data.result?.subdomain) throw new Error('Unable to look up the account workers.dev subdomain. No deployment performed.');
  const origin = `https://${name}.${data.result.subdomain}.workers.dev`;

  console.log(`\nDeploy Worker: ${name}\nAccount: ${selected.name} (${account})\nURL: ${origin}`);
  run(['check']);
  const admin = ensureLocalAdminSecret();
  wrangler(['deploy', '--name', name, '--keep-vars']);

  let hasRemoteAdminSecret = false;
  try {
    const secrets = JSON.parse(wrangler(['secret', 'list', '--name', name, '--format', 'json'], true));
    hasRemoteAdminSecret = Array.isArray(secrets) && secrets.some((item) => item.name === 'ADMIN_SECRET');
  } catch { /* A new Worker has no secrets yet; create the admin secret below. */ }
  if (admin.generated || !hasRemoteAdminSecret) {
    // Secret input is piped to Wrangler and never echoed or logged by this helper.
    wrangler(['secret', 'put', 'ADMIN_SECRET', '--name', name], false, admin.secret);
    console.log('Admin secret provisioned from the ignored .dev.vars file.');
  }

  console.log(`\nDeployed: ${origin}\nAdmin page: ${origin}/admin\nThe admin secret is stored locally in the ignored .dev.vars file.`);
  try {
    const smoke = await fetch(origin, { redirect: 'manual' });
    const html = await smoke.text();
    console.log(smoke.ok && html.includes('MultiPerson Chat')
      ? 'Smoke check: chat page returned successfully.'
      : `Smoke check returned HTTP ${smoke.status}; verify the URL in your browser.`);
  } catch { console.log('Smoke check unavailable. Verify the URL in your browser.'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  deploy().catch(error => { console.error(error.message); process.exitCode = 1; });
}
