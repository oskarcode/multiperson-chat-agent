import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { Miniflare, convertV4MiniflareOptions } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const code = readFileSync('.wrangler/dry-run/index.js', 'utf8');

export function localOptions(persist, extraBindings = {}) {
  return convertV4MiniflareOptions({
    modules: [
      { type: 'ESModule', path: resolve('test-runtime.js'), contents: `import handler, { ChatRoom } from './test-app.js'; export { ChatRoom }; export default handler;` },
      { type: 'ESModule', path: resolve('test-app.js'), contents: code },
    ],
    compatibilityDate: '2025-10-21',
    compatibilityFlags: ['nodejs_compat'],
    durableObjects: { ROOMS: { className: 'ChatRoom', useSQLite: true } },
    resourcePersistencePath: persist || undefined,
    bindings: { AI_MODEL: '@cf/zai-org/glm-4.7-flash', MCP_URL: '', ...extraBindings },
  });
}

async function request(mf, path, body, method = body ? 'POST' : 'GET') {
  const response = await mf.dispatchFetch('http://localhost' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json().catch(() => ({})), response };
}

test('room chat is shared by room ID, isolated between IDs, and streamed to browsers', async () => {
  const mf = new Miniflare(localOptions(false));
  try {
    const home = await mf.dispatchFetch('http://localhost/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /MultiPerson Chat/);

    assert.deepEqual((await request(mf, '/api/rooms/lobby/messages')).data.messages, []);
    const alice = await request(mf, '/api/rooms/lobby/messages', { authorName: 'Alice', text: 'Hello, room!', target: 'group' });
    assert.equal(alice.status, 201);
    const bob = await request(mf, '/api/rooms/lobby/messages', { authorName: 'Bob', text: 'Hi Alice.', target: 'group' });
    assert.equal(bob.status, 201);
    const shared = await request(mf, '/api/rooms/lobby/messages');
    assert.deepEqual(shared.data.messages.map(message => message.authorName), ['Alice', 'Bob']);
    assert.deepEqual((await request(mf, '/api/rooms/another-room/messages')).data.messages, []);

    const stream = await mf.dispatchFetch('http://localhost/api/rooms/lobby/events');
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get('content-type'), /text\/event-stream/);
    const reader = stream.body.getReader();
    const first = await reader.read();
    assert.match(new TextDecoder().decode(first.value), /Hello, room!/);
    await reader.cancel();

    assert.deepEqual(await (await request(mf, '/api/rooms/lobby/mcp')).data, { configured: false, tools: [] });
    assert.equal((await request(mf, '/api/rooms/bad%2Froom/messages')).status, 400);
    assert.equal((await request(mf, '/api/me')).status, 404);
  } finally { await mf.dispose(); }
});
