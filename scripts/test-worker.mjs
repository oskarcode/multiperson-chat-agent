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
    bindings: { AI_MODEL: '@cf/zai-org/glm-5.3', MCP_URL: '', ADMIN_SECRET: adminSecret, ...extraBindings },
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

async function connectSocket(mf, path) {
  const response = await mf.dispatchFetch('http://localhost' + path, { headers: { Upgrade: 'websocket' } });
  assert.equal(response.status, 101);
  assert.ok(response.webSocket);
  const socket = response.webSocket;
  const messages = [];
  socket.addEventListener('message', (event) => {
    try { messages.push(JSON.parse(event.data)); } catch { /* Ignore invalid test frames. */ }
  });
  socket.accept();
  return {
    socket,
    waitFor(predicate, timeoutMs = 4_000) {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const started = Date.now();
        const poll = setInterval(() => {
          const match = messages.find(predicate);
          if (match) { clearInterval(poll); resolve(match); }
          else if (Date.now() - started >= timeoutMs) { clearInterval(poll); reject(new Error('Timed out waiting for a WebSocket frame.')); }
        }, 10);
      });
    },
  };
}

test('admin creates shareable workspaces; guests share chat and receive snapshots over hibernatable WebSockets', async () => {
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
    const alice = await connectSocket(mf, `/api/workspaces/${workspaceId}/socket`);
    const bob = await connectSocket(mf, `/api/workspaces/${workspaceId}/socket`);
    const initial = await alice.waitFor(frame => frame.type === 'snapshot');
    assert.equal(initial.snapshot.workspace.title, 'Planning room');
    const aliceRequest = { type: 'send', target: 'group', requestId: 'guest-alice-1', authorName: 'Alice', text: 'Hello, workspace!' };
    alice.socket.send(JSON.stringify(aliceRequest));
    await alice.waitFor(frame => frame.type === 'ack' && frame.requestId === aliceRequest.requestId);
    await bob.waitFor(frame => frame.type === 'snapshot' && frame.snapshot.messages.some(message => message.text === 'Hello, workspace!'));
    alice.socket.send(JSON.stringify(aliceRequest));
    const bobRequest = { type: 'send', target: 'group', requestId: 'guest-bob-1', authorName: 'Bob', text: 'Hi Alice.' };
    bob.socket.send(JSON.stringify(bobRequest));
    await bob.waitFor(frame => frame.type === 'ack' && frame.requestId === bobRequest.requestId);
    await alice.waitFor(frame => frame.type === 'snapshot' && frame.snapshot.messages.some(message => message.text === 'Hi Alice.'));
    const shared = await request(mf, `/api/workspaces/${workspaceId}/messages`);
    assert.deepEqual(shared.data.messages.map(message => message.authorName), ['Alice', 'Bob']);
    assert.equal((await request(mf, `/api/workspaces/${workspaceId}/messages`, { authorName: 'Legacy', text: 'No longer accepted', target: 'group' })).status, 404);

    const second = await request(mf, '/api/admin/workspaces', { title: 'Separate project' }, 'POST', true);
    assert.deepEqual((await request(mf, `/api/workspaces/${second.data.workspace.id}/messages`)).data.messages, []);
    const listed = await request(mf, '/api/admin/state', undefined, 'GET', true);
    assert.equal(listed.status, 200);
    assert.equal(listed.data.workspaces.length, 2);

    assert.equal((await mf.dispatchFetch(`http://localhost/api/workspaces/${workspaceId}/events`)).status, 404);
    alice.socket.close();
    bob.socket.close();

    assert.deepEqual(await (await request(mf, `/api/workspaces/${workspaceId}/mcp`)).data, { configured: false, servers: [], tools: [] });
    assert.equal((await request(mf, '/api/admin/mcp-servers', { name: 'Invalid endpoint', url: 'http://127.0.0.1/mcp' }, 'POST', true)).status, 400);
    const disconnected = await request(mf, '/api/admin/mcp', { url: '' }, 'PUT', true);
    assert.equal(disconnected.status, 200);
    assert.equal(disconnected.data.configured, false);

    const adminNamespace = await mf.getDurableObjectNamespace('ADMIN');
    const control = adminNamespace.getByName('mcp-concurrency-test');
    const [firstServer, secondServer] = await Promise.all([
      control.addMcpServer({ name: 'Docs', url: 'https://docs.example.com/mcp' }),
      control.addMcpServer({ name: 'Search', url: 'https://search.example.com/mcp' }),
    ]);
    const configuredServers = await control.getMcpServers();
    assert.equal(configuredServers.length, 2);
    assert.deepEqual(new Set(configuredServers.map(server => server.id)), new Set([firstServer.id, secondServer.id]));
    assert.equal(await control.removeMcpServer(firstServer.id), true);
    assert.deepEqual((await control.getMcpServers()).map(server => server.id), [secondServer.id]);
    assert.equal(await control.removeMcpServer('00000000-0000-0000-0000-000000000000'), false);

    const globalControl = adminNamespace.getByName('global');
    const existingServer = await globalControl.addMcpServer({ name: 'Existing connector', url: 'https://existing.example.com/mcp' });
    const duplicateName = await request(mf, '/api/admin/mcp-servers', { name: 'existing CONNECTOR', url: 'https://another.example.com/mcp' }, 'POST', true);
    assert.equal(duplicateName.status, 409);
    const removedServer = await request(mf, '/api/admin/mcp-servers/' + existingServer.id, undefined, 'DELETE', true);
    assert.equal(removedServer.status, 200);
    assert.equal((await globalControl.getMcpServers()).length, 0);

    const legacyMf = new Miniflare(localOptions(false, { MCP_URL: 'https://legacy.example.com/mcp' }));
    try {
      const legacyAdmin = (await legacyMf.getDurableObjectNamespace('ADMIN')).getByName('global');
      const migratedServers = await legacyAdmin.getMcpServers();
      assert.equal(migratedServers.length, 1);
      assert.equal(migratedServers[0].name, 'legacy.example.com');
      assert.equal(migratedServers[0].url, 'https://legacy.example.com/mcp');
      assert.deepEqual(await legacyAdmin.getMcpServers(), migratedServers);
    } finally { await legacyMf.dispose(); }
    assert.equal((await request(mf, '/api/admin/workspaces/' + workspaceId, undefined, 'DELETE')).status, 401);
    const deleted = await request(mf, '/api/admin/workspaces/' + workspaceId, undefined, 'DELETE', true);
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.data, { deleted: true });
    assert.equal((await mf.dispatchFetch(`http://localhost/w/${workspaceId}`)).status, 404);
    assert.equal((await request(mf, `/api/workspaces/${workspaceId}/messages`)).status, 404);
    assert.equal((await request(mf, `/api/rooms/${workspaceId}/messages`)).status, 404);
    assert.equal((await request(mf, '/api/admin/workspaces', undefined, 'GET', true)).data.workspaces.length, 1);
    assert.equal((await request(mf, '/api/workspaces/bad%2Fid/messages')).status, 400);
    assert.equal((await request(mf, '/api/me')).status, 404);
  } finally { await mf.dispose(); }
});
