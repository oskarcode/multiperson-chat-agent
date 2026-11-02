import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { planSecrets } from './deploy-agent.mjs';

// Use the exact Miniflare version bundled with installed Wrangler, not a second runtime.
const require = createRequire(import.meta.url);
const { Miniflare, convertV4MiniflareOptions } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const code = readFileSync('.wrangler/dry-run/index.js', 'utf8');

export function localOptions(persist, extraBindings = {}) {
  return convertV4MiniflareOptions({
    modules: [
      { type: 'ESModule', path: resolve('test-runtime.js'), contents: `import handler, { MultiPersonChat, PiSession } from './test-app.js';
        export class TestGroup extends MultiPersonChat {
          async testSQL(sql, ...args) { return this.ctx.storage.sql.exec(sql, ...args).toArray(); }
        }
        export { PiSession };
        export default handler;` },
      { type: 'ESModule', path: resolve('test-app.js'), contents: code },
    ],
    compatibilityDate: '2025-10-21', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { CHAT: { className: 'TestGroup', useSQLite: true }, SESSIONS: { className: 'PiSession', useSQLite: true } },
    resourcePersistencePath: persist || undefined,
    bindings: { SESSION_SECRET: 'local-only-signing-key', ...extraBindings },
    // No remote AI binding: these tests cannot spend credits or access live data.
  });
}

async function request(mf, path, body, cookie, method = body ? 'POST' : 'GET') {
  const response = await mf.dispatchFetch('http://localhost' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const ownerInput = { name: 'Owner', email: 'owner@example.com', password: 'password-123', groupName: 'Our test group' };

if (process.argv[1]?.endsWith('test-onboarding.mjs')) {
  test('deploy planning preserves secrets and rejects incompatible configuration', () => {
    assert.deepEqual(planSecrets([{ name: 'SESSION_SECRET' }], true), {});
    assert.throws(() => planSecrets([], true), /missing SESSION_SECRET/);
    const secrets = planSecrets([], false);
    assert.ok(secrets.SESSION_SECRET.length >= 40);
    assert.deepEqual(Object.keys(secrets), ['SESSION_SECRET']);
  });

  test('fresh setup, invitations, private rooms and code-only restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'group-test-'));
    let mf = new Miniflare(localOptions(directory));
    try {
      assert.equal((await request(mf, '/api/me')).data.setup.configured, false);
      const owners = await Promise.all([request(mf, '/api/setup', ownerInput), request(mf, '/api/setup', { ...ownerInput, email: 'other@example.com' })]);
      assert.deepEqual(owners.map(r => r.status).sort(), [201, 400]);
      const owner = owners.find(r => r.status === 201);
      const ownerCookie = owner.cookie;
      assert.equal((await request(mf, '/api/me', null, ownerCookie)).data.setup.groupName, 'Our test group');
      const piStatus = await request(mf, '/api/pi/status', null, ownerCookie);
      assert.equal(piStatus.status, 200);
      assert.equal(piStatus.data.ok, true);
      assert.equal(piStatus.data.rootConversationId, 1);
      const rooms = (await request(mf, '/api/workspaces', null, ownerCookie)).data.workspaces;
      assert.equal(rooms.length, 1); assert.equal(rooms[0].title, 'General room');
      const groupRoom = rooms[0].id;
      const privateRoom = (await request(mf, '/api/workspaces', { title: 'Private planning' }, ownerCookie)).data.id;
      const runAt = Date.now() + 10 * 60 * 1000;
      const schedule = await request(mf, '/api/schedules', { workspaceId: groupRoom, instruction: 'Take out trash', runAt }, ownerCookie);
      assert.equal(schedule.status, 201);
      assert.equal(schedule.data.instruction, 'Take out trash');
      assert.equal((await request(mf, '/api/schedules', null, ownerCookie)).data.schedules.length, 1);
      const invite = async room => (await request(mf, '/api/invites', { workspaceId: room }, ownerCookie)).data;
      const firstInvite = await invite(groupRoom);
      const joins = await Promise.all(['a', 'b'].map(n => request(mf, '/api/join', { code: firstInvite.code, name: n })));
      assert.deepEqual(joins.map(r => r.status).sort(), [201, 400]);
      const guest = joins.find(r => r.status === 201);
      assert.equal(guest.data.member.email, null);
      assert.deepEqual((await request(mf, '/api/workspaces', null, guest.cookie)).data.workspaces.map(r => r.id), [groupRoom]);
      assert.equal((await request(mf, '/api/workspaces', { title: 'Guest room' }, guest.cookie)).status, 403);
      assert.equal((await request(mf, `/api/workspaces/${privateRoom}/messages`, null, guest.cookie)).status, 400);
      const laterRoom = (await request(mf, '/api/workspaces', { title: 'New private room' }, ownerCookie)).data.id;
      assert.equal((await request(mf, `/api/workspaces/${laterRoom}/messages`, null, guest.cookie)).status, 400);
      const secondInvite = await invite(privateRoom);
      assert.equal((await request(mf, '/api/invites/accept', { code: secondInvite.code })).status, 401);
      const accepted = await request(mf, '/api/invites/accept', { code: secondInvite.code }, guest.cookie);
      assert.equal(accepted.status, 200); assert.equal(accepted.data.workspaceId, privateRoom);
      assert.equal((await request(mf, '/api/invites/accept', { code: secondInvite.code }, guest.cookie)).status, 400);
      assert.equal((await request(mf, '/api/me', null, guest.cookie)).data.member.role, 'member');
      assert.equal((await request(mf, '/api/schedules', null, guest.cookie)).data.schedules.length, 1);
      assert.equal((await request(mf, `/api/schedules/${schedule.data.id}`, null, guest.cookie, 'DELETE')).status, 403);
      assert.equal((await request(mf, '/api/pi/status', null, guest.cookie)).status, 403);
      const revoked = await invite(groupRoom);
      assert.equal((await request(mf, `/api/invites/${revoked.code}`, null, guest.cookie, 'DELETE')).status, 400);
      assert.equal((await request(mf, `/api/invites/${revoked.code}`, null, ownerCookie, 'DELETE')).status, 200);
      assert.equal((await request(mf, `/api/schedules/${schedule.data.id}`, null, ownerCookie, 'DELETE')).status, 200);
      assert.equal((await request(mf, '/api/invites/accept', { code: revoked.code }, guest.cookie)).status, 400);
      const ns = await mf.getDurableObjectNamespace('CHAT');
      const stub = ns.get(ns.idFromName('default-group'));
      const expired = await invite(groupRoom);
      await stub.testSQL('UPDATE invites SET expires_at = 0 WHERE code = ?', expired.code);
      assert.equal((await request(mf, '/api/invites/accept', { code: expired.code }, guest.cookie)).status, 400);
      const legacy = await invite(groupRoom);
      await stub.testSQL('UPDATE invites SET workspace_id = NULL WHERE code = ?', legacy.code);
      assert.equal((await request(mf, '/api/invites/accept', { code: legacy.code }, guest.cookie)).status, 400);
      // A storage failure rolls back member creation and leaves setup available.
      const isolated = ns.get(ns.idFromName('rollback-test'));
      await isolated.testSQL("CREATE TRIGGER fail_room BEFORE INSERT ON workspaces BEGIN SELECT RAISE(ABORT, 'test failure'); END");
      await assert.rejects(isolated.setupAppOwner({ ...ownerInput, passwordHash: 'test-hash' }));
      assert.equal((await isolated.setupStatus()).configured, false);
      // A code/runtime restart retains SQLite state and previously issued sessions.
      await mf.dispose(); mf = new Miniflare(localOptions(directory));
      assert.equal((await request(mf, '/api/me', null, ownerCookie)).data.member.id, owner.data.member.id);
      assert.equal((await request(mf, '/api/workspaces', null, guest.cookie)).data.workspaces.length, 2);
      assert.equal((await request(mf, '/api/setup', ownerInput)).status, 400);
    } finally { await mf.dispose(); rmSync(directory, { recursive: true, force: true }); }
  });

  test('unsigned requests cannot read chat data', async () => {
    const mf = new Miniflare(localOptions(false));
    try {
      assert.equal((await request(mf, '/api/workspaces')).status, 401);
      assert.equal((await request(mf, '/api/members')).status, 401);
    } finally { await mf.dispose(); }
  });
}
