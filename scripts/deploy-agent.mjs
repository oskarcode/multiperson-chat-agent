#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Pure planning function: updates never rotate an existing session secret.
export function planSecrets(bindings, exists) {
  const names = new Set(bindings.map(b => b.name));
  const missing = ['SESSION_SECRET'].filter(n => !names.has(n));
  if (exists && missing.length) throw new Error('Existing Worker is missing SESSION_SECRET. Refusing to reset credentials; review it manually.');
  return Object.fromEntries(missing.map(n => [n, randomBytes(32).toString('base64url')]));
}

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
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8')); // This project's config is JSON-compatible.
  const name = options['--name'];
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)) throw new Error('Invalid Worker name.');
  let environment = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
  const run = (commandArgs, capture = false) => {
    const result = spawnSync('pnpm', commandArgs, { encoding: 'utf8', env: environment, stdio: capture ? 'pipe' : 'inherit' });
    if (result.error || result.status !== 0) throw new Error(`Command failed: pnpm ${commandArgs.join(' ')}`);
    return result.stdout || '';
  };
  const wrangler = (commandArgs, capture = false) => run(['exec', 'wrangler', ...commandArgs], capture);
  let identity;
  try { identity = JSON.parse(wrangler(['whoami', '--json'], true)); }
  catch { throw new Error('Unable to verify Cloudflare authentication. Run wrangler login with the owner, then retry.'); }
  const accounts = identity.accounts || [];
  const account = options['--account'];
  if (!accounts.some(a => a.id === account)) throw new Error('Select an account returned by Wrangler whoami.');
  if (config.account_id && config.account_id !== account) throw new Error('Configured account differs from the approved account. Stop and review the target.');
  environment = { ...environment, CLOUDFLARE_ACCOUNT_ID: account };
  // Capture credentials in memory only; never log token output or include it in arguments.
  const credential = JSON.parse(wrangler(['auth', 'token', '--json'], true));
  const headers = credential.type === 'api_key'
    ? { 'X-Auth-Key': credential.key, 'X-Auth-Email': credential.email }
    : { Authorization: `Bearer ${credential.token}` };
  const api = async (path, allowMissing = false) => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, { headers });
    const data = await response.json();
    if (allowMissing && response.status === 404 && data.errors?.some(e => e.code === 10007)) return null;
    if (!response.ok || !data.success) throw new Error(`Cloudflare lookup failed (${response.status}) for ${path}. No deployment performed.`);
    return data.result;
  };
  const settings = await api(`/workers/scripts/${name}/settings`, true);
  // --keep-vars preserves omitted vars, but local definitions still override remote values.
  for (const binding of settings?.bindings || []) {
    if (binding.name === 'SESSION_SECRET' && Object.hasOwn(config.vars || {}, binding.name) && (binding.type !== 'plain_text' || binding.text !== config.vars[binding.name])) {
      throw new Error('Local SESSION_SECRET conflicts with the existing Worker secret. Review manually.');
    }
  }
  const bindings = [...(settings?.bindings || []), ...Object.entries(config.vars || {}).map(([name, text]) => ({ name, text, type: 'plain_text' }))];
  const secrets = planSecrets(bindings, settings !== null);
  const subdomain = await api('/workers/subdomain');
  if (!subdomain?.subdomain) throw new Error('Enable your workers.dev subdomain in the Cloudflare dashboard first.');
  const origin = `https://${name}.${subdomain.subdomain}.workers.dev`;
  console.log(`\n${settings ? 'UPDATE existing' : 'CREATE new'} Worker: ${name}\nAccount: ${accounts.find(a => a.id === account).name} (${account})\nURL: ${origin}\nExisting secrets will be preserved.`);
  run(['check']);
  const temporary = mkdtempSync(join(tmpdir(), 'multiperson-chat-deploy-'));
  try {
    const command = ['deploy', '--name', name, '--keep-vars'];
    if (Object.keys(secrets).length) {
      const file = join(temporary, 'secrets.json');
      writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
      command.push('--secrets-file', file);
    }
    wrangler(command);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
  console.log(`\nDeployed: ${origin}\nOpen the Worker URL and create your chat space, or sign in if it is already configured.`);
  // Never follow redirects or send the setup credential during the smoke check.
  try {
    const response = await fetch(`${origin}/api/me`, { redirect: 'manual' });
    if (response.ok) {
      const state = await response.json();
      console.log(`Smoke check: owner configured=${state.setup?.configured}, secrets ready=${state.configured}`);
    } else console.log(`Smoke check returned HTTP ${response.status}; verify the URL in your browser.`);
  } catch { console.log('Smoke check unavailable. Verify the URL in your browser.'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  deploy().catch(error => { console.error(error.message); process.exitCode = 1; });
}
