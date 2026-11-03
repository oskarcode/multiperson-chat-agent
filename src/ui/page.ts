export const appPage = String.raw`
  <main class="shell workspace-shell">
    <aside class="workspace-sidebar" aria-label="Workspace details">
      <header class="topbar">
        <div class="brand"><span class="brand-mark" aria-hidden="true">✦</span><div><h1 id="workspaceTitle">MultiPerson Chat</h1><p>Talk together, or bring in the workspace agent.</p></div></div>
      </header>
      <div class="guest-controls">
        <label>Your name<input id="authorName" maxlength="80" autocomplete="name" /></label>
        <span class="muted">Your share link selects the workspace.</span>
      </div>
      <details class="mcp-panel">
        <summary>Public MCP tools <span id="mcpSummary" class="muted">Checking…</span></summary>
        <p class="muted">The admin can connect one public Streamable HTTP MCP server for all workspaces.</p>
        <button id="refreshMcp" class="secondary" type="button">Check MCP tools</button>
        <p id="mcpStatus" class="muted" role="status"></p>
        <ul id="mcpTools"></ul>
      </details>
      <footer class="sidebar-footer">Pi Durable keeps each workspace’s conversation and scheduled work in its own Cloudflare Durable Object. <a href="/admin">Workspace admin</a></footer>
    </aside>

    <section class="workspace-main" aria-label="Workspace conversation">
      <p id="status" class="status" role="status">Connecting…</p>
      <section class="chat card" aria-label="Workspace chat">
        <div id="messages" class="messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
        <details id="activityPanel" class="activity-panel hidden">
          <summary>Live agent activity <span id="activitySummary" class="muted">Idle</span></summary>
          <div id="progress" class="progress" role="status"></div>
        </details>
        <form id="composerForm" class="composer">
          <label class="sr-only" for="composer">Message</label>
          <textarea id="composer" rows="3" placeholder="Message your workspace…" maxlength="4000"></textarea>
          <div class="composer-footer"><span class="muted">Anyone with this share link can read and post.</span><div class="actions"><button id="sendGroup" class="secondary" type="button">Send to group</button><button id="sendAgent" type="button">Ask Agent</button></div></div>
        </form>
        <p id="error" class="error" role="alert"></p>
      </section>
    </section>
  </main>
`;
