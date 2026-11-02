import { chromium, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { localOptions } from './test-worker.mjs';
const require = createRequire(import.meta.url);
const { Miniflare } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const mf = new Miniflare(localOptions(false));
let browser;
try {
  const base = (await mf.ready).origin;
  browser = await chromium.launch();
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  const errors = [];
  for (const page of [alice, bob]) page.on('pageerror', error => errors.push(error.message));

  await alice.goto(base + '/?room=family');
  await alice.locator('#authorName').fill('Alice');
  await expect(alice.locator('#status')).toContainText('Connected to public room');
  await bob.goto(base + '/?room=family');
  await bob.locator('#authorName').fill('Bob');
  await expect(bob.locator('#status')).toContainText('Connected to public room');

  await alice.locator('#composer').fill('Hello to everyone in this room.');
  await alice.locator('#sendGroup').click();
  await expect(alice.locator('#messages')).toContainText('Hello to everyone in this room.');
  await expect(bob.locator('#messages')).toContainText('Hello to everyone in this room.');
  await bob.locator('#composer').fill('This is a shared room.');
  await bob.locator('#sendGroup').click();
  await expect(alice.locator('#messages')).toContainText('This is a shared room.');

  await bob.locator('#roomId').fill('another-room');
  await bob.locator('#connectRoom').click();
  await expect(bob.locator('#messages')).not.toContainText('Hello to everyone in this room.');
  await bob.locator('#composer').fill('Only in another room.');
  await bob.locator('#sendGroup').click();
  await expect(bob.locator('#messages')).toContainText('Only in another room.');
  await expect(alice.locator('#messages')).not.toContainText('Only in another room.');

  const progressPage = await browser.newPage();
  let agentRequest;
  const partialSnapshot = {
    messages: [],
    progress: { active: true, partialText: 'A streamed partial answer.', tools: [{ name: 'call_mcp_tool', status: 'running', output: 'Searching…' }] },
  };
  await progressPage.route('**/api/rooms/progress-room/events', route => route.fulfill({
    status: 200, headers: { 'content-type': 'text/event-stream' }, body: `data: ${JSON.stringify(partialSnapshot)}\n\n`,
  }));
  await progressPage.route('**/api/rooms/progress-room/messages', async route => {
    agentRequest = route.request().postDataJSON();
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ requestId: 'browser-agent-request' }) });
  });
  await progressPage.goto(base + '/?room=progress-room');
  await expect(progressPage.locator('#messages')).toContainText('A streamed partial answer.');
  await expect(progressPage.locator('#progress')).toContainText('Agent is using a tool');
  await expect(progressPage.locator('#progress')).toContainText('call_mcp_tool');
  await progressPage.locator('#composer').fill('Please help.');
  await progressPage.locator('#sendAgent').click();
  await expect.poll(() => agentRequest?.target).toBe('agent');

  await bob.setViewportSize({ width: 390, height: 844 });
  await expect(bob.locator('#composer')).toBeVisible();
  expect(await bob.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(alice.locator('#mcpSummary')).toHaveText('not configured');
  expect(errors).toEqual([]);
  console.log('Browser tests passed: shared rooms, isolation, live updates, Pi progress rendering, agent requests, public MCP status, and mobile layout.');
} finally { await browser?.close(); await mf.dispose(); }
