export const appPage = String.raw`
  <main class="workspace-shell">
    <aside class="workspace-sidebar" aria-label="Workspace details">
      <a class="brand" href="/" aria-label="MultiPerson Chat home">
        <span class="brand-mark" aria-hidden="true">✦</span>
        <span class="brand-copy"><span class="brand-name">MULTIPERSON CHAT</span><span class="brand-caption">shared workspace</span></span>
      </a>

      <section class="sidebar-block workspace-card" aria-labelledby="workspaceLabel">
        <p id="workspaceLabel" class="eyebrow">Workspace</p>
        <h1 id="workspaceTitle">MultiPerson Chat</h1>
        <div class="access-note"><span class="access-icon" aria-hidden="true">↗</span><span>Anyone with this link can read and post</span></div>
      </section>

      <section class="sidebar-block profile-block" aria-labelledby="profileLabel">
        <p id="profileLabel" class="eyebrow">Your profile</p>
        <label class="profile-field"><span class="profile-avatar" aria-hidden="true">G</span><span class="sr-only">Your name</span><input id="authorName" maxlength="80" autocomplete="name" aria-label="Your name" placeholder="Your name" /></label>
        <p class="field-hint">This name appears beside your messages.</p>
      </section>

      <details class="mcp-panel">
        <summary><span class="mcp-summary-title"><span class="mcp-icon" aria-hidden="true">⌘</span><span>Connected tools</span></span><span id="mcpSummary" class="tool-status">Checking…</span></summary>
        <div class="mcp-content">
          <p class="muted">One public MCP server is shared across workspaces. The agent can use its tools when helpful.</p>
          <button id="refreshMcp" class="text-button" type="button">Refresh tool list <span aria-hidden="true">↻</span></button>
          <p id="mcpStatus" class="mcp-status-copy" role="status"></p>
          <ul id="mcpTools" class="mcp-tools"></ul>
        </div>
      </details>

      <div class="sidebar-spacer"></div>
      <div class="sidebar-public-note"><span class="note-dot" aria-hidden="true"></span><span>This is a public demo room. Share the link only with people you trust.</span></div>
      <footer class="sidebar-footer"><span>Powered by Pi Durable + Workers AI</span><a href="/admin">Workspace admin <span aria-hidden="true">↗</span></a></footer>
    </aside>

    <section class="workspace-main" aria-label="Workspace conversation">
      <header class="chat-header">
        <div class="chat-heading"><p class="eyebrow">Shared conversation</p><p class="chat-subtitle">A place for everyone in this workspace to think together.</p></div>
        <div class="header-status"><span class="connection-pill"><span class="connection-dot" aria-hidden="true"></span><span id="status" role="status">Connecting…</span></span></div>
      </header>

      <section class="chat card" aria-label="Workspace chat">
        <div id="messages" class="messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
        <details id="activityPanel" class="activity-panel hidden">
          <summary><span class="activity-icon" aria-hidden="true">✳</span><span class="activity-label">Agent activity</span><span id="activitySummary" class="muted">Idle</span><span class="summary-chevron" aria-hidden="true">⌄</span></summary>
          <div id="progress" class="progress" role="status"></div>
        </details>
        <form id="composerForm" class="composer">
          <div class="compose-card">
            <label class="sr-only" for="composer">Message</label>
            <textarea id="composer" rows="3" placeholder="Write a message to your workspace…" maxlength="4000"></textarea>
            <div class="compose-toolbar">
              <div class="compose-meta"><span class="model-chip composer-model"><span class="model-dot" aria-hidden="true"></span>Workers AI</span><span class="compose-hint">Choose who should receive your message</span></div>
              <div class="actions"><button id="sendGroup" class="secondary" type="button"><span class="button-icon" aria-hidden="true">↗</span>Send to group</button><button id="sendAgent" type="button"><span class="button-icon" aria-hidden="true">✦</span>Ask Agent</button></div>
            </div>
          </div>
          <p class="composer-footnote"><span>Messages are visible to everyone with this share link.</span><span>Enter a message, then choose a destination</span></p>
        </form>
        <p id="error" class="error" role="alert"></p>
      </section>
    </section>
  </main>
`;
