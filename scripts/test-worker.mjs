import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { Miniflare, convertV4MiniflareOptions } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const code = readFileSync('.wrangler/dry-run/index.js', 'utf8');
const adminSecret = 'test-admin-secret';

export function localOptions(persist, extraBindings = {}) {
  return convertV4MiniflareOptions({
    modules: [
      { type: 'ESModule', path: resolve('test-runtime.js'), contents: `import handler, { ChatRoom, DemoAdmin } from './test-app.js'; export { ChatRoom, DemoAdmin }; export default handler;` },
      { type: 'ESModule', path: resolve('test-app.js'), contents: code },
    ],
    compatibilityDate: '2025-10-21',
    compatibilityFlags: ['nodejs_compat'],
    durableObjects: {
      ROOMS: { className: 'ChatRoom', useSQLite: true },
      ADMIN: { className: 'DemoAdmin', useSQLite: true },
    },
    resourcePersistencePath: persist || undefined,
    bindings: { AI_MODEL: '@cf/zai-org/glm-4.7-flash', MCP_URL: '', ADMIN_SECRET: adminSecret, ...extraBindings },
  });
}

async function request(mf, path, body, method = body ? 'POST' : 'GET', authorized = false) {
  const response = await mf.dispatchFetch('http://localhost' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authorized ? { Authorization: `Bearer ${adminSecret}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json().catch(() => ({})), response };
}

test('admin creates shareable workspace instances; guests share chat and receive SSE without auth', async () => {
  const mf = new Miniflare(localOptions(false));
  try {
    const home = await mf.dispatchFetch('http://localhost/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /MultiPerson Chat/);
    const adminPage = await mf.dispatchFetch('http://localhost/admin');
    assert.equal(adminPage.status, 200);
    const adminHtml = await adminPage.text();
    assert.match(adminHtml, /Workspace admin/);
    assert.equal(adminHtml.includes(adminSecret), false);
    assert.equal((await mf.dispatchFetch('http://localhost/w/not-created')).status, 404);
    assert.equal((await request(mf, '/api/workspaces/not-created/messages')).status, 404);

    assert.equal((await request(mf, '/api/admin/state')).status, 401);
    const created = await request(mf, '/api/admin/workspaces', { title: 'Planning room' }, 'POST', true);
    assert.equal(created.status, 201);
    const workspaceId = created.data.workspace.id;
    assert.equal(created.data.workspace.title, 'Planning room');
    assert.match(workspaceId, /^[0-9a-f-]{36}$/u);
    assert.equal((await mf.dispatchFetch(`http://localhost/w/${workspaceId}`)).status, 200);
    assert.deepEqual((await request(mf, `/api/workspaces/${workspaceId}/info`)).data.workspace.title, 'Planning room');

    assert.deepEqual((await request(mf, `/api/workspaces/${workspaceId}/messages`)).data.messages, []);
    const alice = await request(mf, `/api/workspaces/${workspaceId}/messages`, { authorName: 'Alice', text: 'Hello, workspace!', target: 'group' });
    assert.equal(alice.status, 201);
    const bob = await request(mf, `/api/workspaces/${workspaceId}/messages`, { authorName: 'Bob', text: 'Hi Alice.', target: 'group' });
    assert.equal(bob.status, 201);
    const shared = await request(mf, `/api/workspaces/${workspaceId}/messages`);
    assert.deepEqual(shared.data.messages.map(message => message.authorName), ['Alice', 'Bob']);

    const second = await request(mf, '/api/admin/workspaces', { title: 'Separate project' }, 'POST', true);
    assert.deepEqual((await request(mf, `/api/workspaces/${second.data.workspace.id}/messages`)).data.messages, []);
    const listed = await request(mf, '/api/admin/state', undefined, 'GET', true);
    assert.equal(listed.status, 200);
    assert.equal(listed.data.workspaces.length, 2);

    const stream = await mf.dispatchFetch(`http://localhost/api/workspaces/${workspaceId}/events`);
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get('content-type'), /text\/event-stream/);
    const reader = stream.body.getReader();
    const first = await reader.read();
    const frame = new TextDecoder().decode(first.value);
    assert.match(frame, /Hello, workspace!/);
    assert.match(frame, /Planning room/);
    await reader.cancel();

    assert.deepEqual(await (await request(mf, `/api/workspaces/${workspaceId}/mcp`)).data, { configured: false, tools: [] });
    assert.equal((await request(mf, '/api/admin/mcp', { url: 'http://127.0.0.1/mcp' }, 'PUT', true)).status, 400);
    const disconnected = await request(mf, '/api/admin/mcp', { url: '' }, 'PUT', true);
    assert.equal(disconnected.status, 200);
    assert.equal(disconnected.data.configured, false);
    assert.equal((await request(mf, '/api/workspaces/bad%2Fid/messages')).status, 400);
    assert.equal((await request(mf, '/api/me')).status, 404);
  } finally { await mf.dispose(); }
});
