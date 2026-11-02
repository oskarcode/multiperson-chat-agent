import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deploy } from './deploy-agent.mjs';

test('demo deploy verifies the account and deploys without application secrets', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'multiperson-chat-deploy-test-'));
  const original = { cwd: process.cwd(), argv: process.argv, env: process.env, fetch: globalThis.fetch };
  const account = 'a'.repeat(32);
  try {
    process.chdir(directory);
    mkdirSync('bin');
    writeFileSync('wrangler.jsonc', JSON.stringify({ name: 'test-room', vars: {} }));
    writeFileSync('bin/pnpm', `#!/usr/bin/env node
      const fs = require('node:fs');
      const args = process.argv.slice(2);
      fs.appendFileSync('calls.jsonl', JSON.stringify({ args, account: process.env.CLOUDFLARE_ACCOUNT_ID }) + '\\n');
      if (args.includes('whoami')) console.log(JSON.stringify({ accounts: [{ id: '${account}', name: 'Test account' }] }));
      if (args.includes('token')) console.log(JSON.stringify({ type: 'oauth', token: 'test-token-not-real' }));
    `, { mode: 0o700 });
    process.env = { ...process.env, PATH: join(directory, 'bin') + ':' + process.env.PATH };
    process.argv = ['node', 'deploy-agent.mjs', '--account', account, '--name', 'test-room', '--yes'];
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/workers/subdomain')) {
        assert.equal(init.headers.Authorization, 'Bearer test-token-not-real');
        return Response.json({ success: true, result: { subdomain: 'test-account' } });
      }
      if (String(url) === 'https://test-room.test-account.workers.dev') {
        return new Response('<title>MultiPerson Chat</title>');
      }
      throw new Error('Unexpected URL');
    };

    await deploy();
    const log = readFileSync('calls.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
    const check = log.find(call => call.args.includes('check'));
    const deployed = log.find(call => call.args.includes('deploy'));
    assert.ok(check);
    assert.ok(deployed.args.includes('--keep-vars'));
    assert.equal(deployed.account, account);
    assert.equal(deployed.args.includes('--secrets-file'), false);
    assert.equal(calls.length, 2);
    assert.ok(!readFileSync('calls.jsonl', 'utf8').includes('SESSION_SECRET'));
  } finally {
    process.chdir(original.cwd); process.argv = original.argv; process.env = original.env; globalThis.fetch = original.fetch;
    rmSync(directory, { recursive: true, force: true });
  }
});
