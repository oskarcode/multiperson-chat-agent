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
  const adminContext = await browser.newContext();
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  const errors = [];
  const mcpFixtures = [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Product docs', url: 'https://docs.example.com/mcp', tools: [{ name: 'search', title: 'Search docs' }] },
    { id: '00000000-0000-4000-8000-000000000002', name: 'Code search', url: 'https://code.example.com/mcp', tools: [{ name: 'search', title: 'Search source' }] },
  ];
  for (const page of [admin, alice, bob]) page.on('pageerror', error => errors.push(error.message));
  await admin.route('**/api/admin/state', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.mcpServers = mcpFixtures;
    await route.fulfill({ response, body: JSON.stringify(data) });
  });
  await admin.route('**/api/admin/mcp-servers**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST') {
      const input = request.postDataJSON();
      if (input.url === 'https://127.0.0.1/mcp') return route.continue();
      const server = { id: '00000000-0000-4000-8000-000000000003', name: input.name, url: input.url, tools: [{ name: 'status', title: 'Get status' }] };
      mcpFixtures.push(server);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ server }) });
    }
    if (request.method() === 'DELETE') {
      const id = pathname.split('/').at(-1);
      const index = mcpFixtures.findIndex(server => server.id === id);
      if (index >= 0) mcpFixtures.splice(index, 1);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ removed: index >= 0 }) });
    }
    return route.continue();
  });

  await admin.goto(base + '/admin');
  await admin.locator('#adminSecret').fill('test-admin-secret');
  await admin.locator('#unlockForm button[type="submit"]').click();
  await expect(admin.locator('#adminContent')).toBeVisible();
  await expect(admin.locator('#mcpServers .mcp-server-item')).toHaveCount(2);
  await expect(admin.locator('#mcpServers')).toContainText('Product docs');
  await expect(admin.locator('#mcpServers')).toContainText('Code search');
  await admin.locator('#workspaceTitle').fill('Family room');
  await admin.locator('#workspaceForm button').click();
  await expect(admin.locator('#workspaces')).toContainText('Family room');
  const familyPath = await admin.locator('#workspaces a').first().getAttribute('href');
  expect(familyPath).toMatch(/^\/w\/[a-f0-9-]{36}$/u);
  const displayedShareUrl = await admin.locator('#workspaces .admin-item').first().locator('.muted').textContent();
  expect(displayedShareUrl?.trim()).toBe(new URL(familyPath, base).href);
  await admin.locator('#workspaceTitle').fill('Project room');
  await admin.locator('#workspaceForm button').click();
  await expect(admin.locator('#workspaces')).toContainText('Project room');
  const projectPath = await admin.locator('#workspaces a').first().getAttribute('href');

  await admin.locator('#mcpName').fill('Invalid endpoint');
  await admin.locator('#mcpUrl').fill('https://127.0.0.1/mcp');
  await admin.locator('#mcpForm button[type="submit"]').click();
  await expect(admin.locator('#mcpStatus')).toContainText('public DNS hostname');
  await admin.locator('#mcpName').fill('Status API');
  await admin.locator('#mcpUrl').fill('https://status.example.com/mcp');
  await admin.locator('#mcpForm button[type="submit"]').click();
  await expect(admin.locator('#mcpServers .mcp-server-item')).toHaveCount(3);
  await expect(admin.locator('#mcpServers')).toContainText('Status API');
  admin.once('dialog', dialog => dialog.accept());
  await admin.locator('#mcpServers .mcp-server-item').first().getByRole('button', { name: 'Remove server' }).click();
  await expect(admin.locator('#mcpServers .mcp-server-item')).toHaveCount(2);
  await expect(admin.locator('#mcpServers')).not.toContainText('Product docs');

  await alice.goto(base + familyPath);
  await expect(alice.locator('#authorName')).toBeVisible();
  await expect(alice.locator('#roomId')).toHaveCount(0);
  await expect(alice.locator('#connectRoom')).toHaveCount(0);
  await alice.locator('#authorName').fill('Alice');
  await expect(alice.locator('#status')).toContainText('Connected to public');
  await expect(alice.locator('#workspaceTitle')).toHaveText('Family room');
  await expect(alice.locator('.workspace-sidebar #authorName')).toBeVisible();
  await expect(alice.locator('.workspace-sidebar .mcp-panel')).toBeVisible();
  await expect(alice.locator('.compose-meta .model-chip')).toHaveText('GLM 5.3');
  await expect(alice.locator('.compose-meta .model-chip')).toHaveAttribute('title', '@cf/zai-org/glm-5.3');
  await expect(alice.locator('.sidebar-footer a')).toHaveCount(0);
  await expect(alice.locator('.compose-toolbar .actions button')).toHaveCount(2);
  const sidebarBounds = await alice.locator('.workspace-sidebar').boundingBox();
  const chatBounds = await alice.locator('.chat').boundingBox();
  expect(sidebarBounds && chatBounds && chatBounds.x > sidebarBounds.width && chatBounds.width > sidebarBounds.width).toBe(true);
  await expect(alice.locator('#status')).not.toContainText(familyPath.slice(3));
  await bob.goto(base + familyPath);
  await bob.locator('#authorName').fill('Bob');
  await expect(bob.locator('#status')).toContainText('Connected to public');

  await alice.locator('#composer').fill('Hello to everyone in this workspace.');
  await alice.locator('#sendGroup').click();
  await expect(alice.locator('#messages')).toContainText('Hello to everyone in this workspace.');
  await expect(alice.locator('.message.group.mine .speaker-avatar')).toHaveText('A');
  await expect(bob.locator('#messages')).toContainText('Hello to everyone in this workspace.');
  await bob.locator('#composer').fill('This workspace is shared.');
  await bob.locator('#sendGroup').click();
  await expect(alice.locator('#messages')).toContainText('This workspace is shared.');

  let bobWebSocketCount = 0;
  bob.on('websocket', () => { bobWebSocketCount += 1; });
  await bob.goto(base + projectPath);
  await expect(bob.locator('#messages')).not.toContainText('Hello to everyone in this workspace.');
  await bob.locator('#composer').fill('Only in the project workspace.');
  await bob.locator('#sendGroup').click();
  await expect(bob.locator('#messages')).toContainText('Only in the project workspace.');
  await expect(alice.locator('#messages')).not.toContainText('Only in the project workspace.');
  const idleConnectionCount = bobWebSocketCount;
  await bob.waitForTimeout(12_000);
  expect(bobWebSocketCount).toBe(idleConnectionCount);
  await bob.locator('#composer').fill('The room remained connected while idle.');
  await bob.locator('#sendGroup').click();
  await expect(bob.locator('#messages')).toContainText('The room remained connected while idle.');

  const familyItem = admin.locator('#workspaces .admin-item').filter({ has: admin.locator(`a[href="${familyPath}"]`) });
  admin.once('dialog', dialog => dialog.accept());
  await familyItem.getByRole('button', { name: 'Delete workspace' }).click();
  await expect(admin.locator('#workspaces')).not.toContainText('Family room');
  await expect(admin.locator('#workspaceStatus')).toContainText('Workspace deleted');

  const progressPage = await browser.newPage();
  progressPage.on('pageerror', error => errors.push(error.message));
  let agentRequest;
  const progressId = projectPath.slice(3);
  const workspace = { id: progressId, title: 'Project room', createdAt: Date.now() };
  let progressSocket;
  const partialSnapshot = {
    workspace,
    messages: [],
    progress: { active: true, phase: 'using-tools', partialText: 'A streamed partial answer.', tools: [{ id: 'tool-call-1', name: 'search', status: 'running', output: 'Searching…' }] },
  };
  await progressPage.routeWebSocket(`**/api/workspaces/${progressId}/socket`, socket => {
    progressSocket = socket;
    socket.send(JSON.stringify({ type: 'snapshot', snapshot: { workspace, messages: [], progress: { active: false, phase: 'idle', partialText: '', tools: [] } } }));
    socket.send(JSON.stringify({ type: 'snapshot', snapshot: partialSnapshot }));
    socket.onMessage(data => {
      try {
        const message = JSON.parse(String(data));
        if (message.type === 'send' && message.target === 'agent') {
          agentRequest = message;
          socket.send(JSON.stringify({ type: 'ack', requestId: message.requestId, status: 'accepted' }));
        }
      } catch { /* Ignore frames outside this browser assertion. */ }
    });
  });
  await progressPage.goto(base + projectPath);
  await expect(progressPage.locator('#messages')).toContainText('A streamed partial answer.');
  await expect(progressPage.locator('.agent-thinking')).toContainText('Group Agent is using tools');
  await expect(progressPage.locator('#messages .agent-activity')).toContainText('Agent started');
  await expect(progressPage.locator('#messages .agent-activity')).toContainText('Agent is using tools');
  await expect(progressPage.locator('#messages .agent-activity')).toContainText('Calling tool: search');
  await expect(progressPage.locator('#messages .agent-activity')).not.toContainText('A streamed partial answer.');
  await expect(progressPage.locator('#messages')).toContainText('A streamed partial answer.');
  const liveActivity = progressPage.locator('#messages .agent-activity');
  await expect(liveActivity).toHaveJSProperty('open', false);
  await expect(liveActivity.locator('.activity-events')).toBeHidden();
  const liveOpenToggle = liveActivity.evaluate(element => new Promise(resolve => element.addEventListener('toggle', resolve, { once: true })));
  await liveActivity.locator('summary').click();
  await liveOpenToggle;
  await expect(liveActivity).toHaveJSProperty('open', true);
  await expect(liveActivity.locator('.activity-events')).toBeVisible();
  const liveCloseToggle = liveActivity.evaluate(element => new Promise(resolve => element.addEventListener('toggle', resolve, { once: true })));
  await liveActivity.locator('summary').click();
  await liveCloseToggle;
  await expect(liveActivity).toHaveJSProperty('open', false);
  progressSocket.send(JSON.stringify({ type: 'snapshot', snapshot: {
    workspace,
    messages: [{ id: 'agent-answer', authorName: 'Group Agent', kind: 'agent', text: '**Short answer**\n\n- First step\n- Second step\n\n[Read more](https://example.com) <img src=x onerror=alert(1)>' }],
    progress: { active: false, phase: 'idle', partialText: '', tools: [] },
  } }));
  await expect(progressPage.locator('#messages strong')).toHaveText('Short answer');
  await expect(progressPage.locator('#messages ul li')).toHaveCount(2);
  await expect(progressPage.locator('#messages a')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(progressPage.locator('#messages img')).toHaveCount(0);
  const responseActivity = progressPage.locator('#messages .message.agent + .agent-activity');
  await expect(responseActivity).toContainText('Agent response received');
  await expect(responseActivity).toHaveJSProperty('open', false);
  const responseToggle = responseActivity.evaluate(element => new Promise(resolve => element.addEventListener('toggle', resolve, { once: true })));
  await responseActivity.locator('summary').click();
  await responseToggle;
  await expect(responseActivity.locator('.activity-events')).toBeVisible();
  await progressPage.locator('#composer').fill('Please help.');
  await progressPage.locator('#sendAgent').click();
  await expect.poll(() => agentRequest?.target).toBe('agent');

  await bob.setViewportSize({ width: 390, height: 844 });
  await expect(bob.locator('#composer')).toBeVisible();
  await expect(bob.locator('.workspace-sidebar .mcp-panel')).toBeVisible();
  const mobileSidebarBounds = await bob.locator('.workspace-sidebar').boundingBox();
  const mobileChatBounds = await bob.locator('.chat').boundingBox();
  expect(mobileSidebarBounds && mobileChatBounds && mobileChatBounds.y > mobileSidebarBounds.height).toBe(true);
  expect(await bob.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(alice.locator('#mcpSummary')).toHaveText('not connected');
  expect(errors).toEqual([]);
  console.log('Browser tests passed: shared workspaces, admin deletion, guest chat, safe Markdown, inline per-response agent activity, MCP configuration, and mobile layout.');
} finally { await browser?.close(); await mf.dispose(); }
