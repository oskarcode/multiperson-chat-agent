import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deploy } from './deploy-agent.mjs';

test('agent deploy: explicit target, safe update and failed lookup (mock Cloudflare)', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'group-deploy-test-'));
  const original = { cwd: process.cwd(), argv: process.argv, env: process.env, fetch: globalThis.fetch };
  const account = 'a'.repeat(32);
  let remote = null;
  let apiFails = false;
  try {
    process.chdir(directory);
    mkdirSync('bin');
    writeFileSync('wrangler.jsonc', JSON.stringify({ name: 'test-group', vars: {} }));
    // Replace ONLY subprocess commands in this fixture. No login, build or deployment leaves the machine.
    writeFileSync('bin/pnpm', `#!/usr/bin/env node
      const fs = require('node:fs');
      const args = process.argv.slice(2);
      fs.appendFileSync('calls.jsonl', JSON.stringify({ args, account: process.env.CLOUDFLARE_ACCOUNT_ID }) + '\\n');
      if (args.includes('whoami')) console.log(JSON.stringify({ accounts: [{ id: '${account}', name: 'Test account' }] }));
      if (args.includes('token')) console.log(JSON.stringify({ type: 'oauth', token: 'test-token-not-real' }));
      if (args.includes('deploy')) {
        const file = args[args.indexOf('--secrets-file') + 1];
        fs.writeFileSync('uploaded.json', JSON.stringify(args.includes('--secrets-file') ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}));
      }
    `, { mode: 0o700 });
    process.env = { ...process.env, PATH: join(directory, 'bin') + ':' + process.env.PATH };
    process.argv = ['node', 'deploy-agent.mjs'];
    await assert.rejects(deploy(), /Usage:/);
    process.argv = ['node', 'deploy-agent.mjs', '--account', account, '--name', 'test-group'];
    await assert.rejects(deploy(), /Usage:/);
    process.argv.push('--yes');
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith('/api/me')) return Response.json({ configured: true, setup: { configured: false } });
      assert.equal(init.headers.Authorization, 'Bearer test-token-not-real');
      if (apiFails) return Response.json({ success: false, errors: [{ code: 10000 }] }, { status: 403 });
      if (String(url).endsWith('/settings')) return remote ? Response.json({ success: true, result: remote }) : Response.json({ success: false, errors: [{ code: 10007 }] }, { status: 404 });
      if (String(url).endsWith('/subdomain')) return Response.json({ success: true, result: { subdomain: 'test-account' } });
      throw new Error('Unexpected URL');
    };
    await deploy();
    const uploaded = JSON.parse(readFileSync('uploaded.json', 'utf8'));
    assert.deepEqual(Object.keys(uploaded), ['SESSION_SECRET']);
    assert.equal(existsSync('.wrangler'), false);
    const firstCalls = readFileSync('calls.jsonl', 'utf8');
    assert.ok(!firstCalls.includes(uploaded.SESSION_SECRET));
    const deployCall = firstCalls.trim().split('\n').map(JSON.parse).find(c => c.args.includes('deploy'));
    assert.ok(deployCall.args.includes('--keep-vars')); assert.equal(deployCall.account, account);
    assert.equal(existsSync(deployCall.args[deployCall.args.indexOf('--secrets-file') + 1]), false);
    remote = { bindings: [{ name: 'SESSION_SECRET', type: 'secret_text' }] };
    await deploy();
    assert.deepEqual(JSON.parse(readFileSync('uploaded.json', 'utf8')), {});
    assert.equal(existsSync('.wrangler'), false);
    apiFails = true;
    await assert.rejects(deploy(), /lookup failed/);
    const calls = readFileSync('calls.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(calls.filter(c => c.args.includes('deploy')).length, 2);
  } finally {
    process.chdir(original.cwd); process.argv = original.argv; process.env = original.env; globalThis.fetch = original.fetch;
    rmSync(directory, { recursive: true, force: true });
  }
});
