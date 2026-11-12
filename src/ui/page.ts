export function appPage(modelName: string, modelId: string): string {
  return String.raw`
  <main class="workspace-shell">
    <aside class="workspace-sidebar" aria-label="Workspace navigation">
      <a class="brand" href="/" aria-label="MultiPerson Chat home">
        <span class="brand-mark" aria-hidden="true">✦</span>
        <span class="brand-copy"><span class="brand-name">MULTIPERSON CHAT</span><span class="brand-caption">shared workspace</span></span>
      </a>

      <section class="workspace-nav-block" aria-labelledby="workspaceNavHeading">
        <div class="workspace-nav-heading"><p id="workspaceNavHeading" class="eyebrow">Workspaces</p><span id="workspaceListScope" class="workspace-list-scope">This browser</span></div>
        <ul id="workspaceList" class="workspace-nav-list" aria-live="polite"><li class="workspace-nav-empty">Loading workspaces…</li></ul>
      </section>

      <div class="sidebar-spacer"></div>

      <section class="sidebar-block profile-block" aria-labelledby="profileLabel">
        <p id="profileLabel" class="eyebrow">Your profile</p>
        <label class="profile-field"><span class="profile-avatar" aria-hidden="true">G</span><span class="sr-only">Your name</span><input id="authorName" maxlength="80" autocomplete="name" aria-label="Your name" placeholder="Your name" /></label>
        <p class="field-hint">This name appears beside your messages.</p>
      </section>

      <details class="mcp-panel">
        <summary><span class="mcp-summary-title"><span class="mcp-icon" aria-hidden="true">⌘</span><span>Connected tools</span></span><span id="mcpSummary" class="tool-status">Checking…</span></summary>
        <div class="mcp-content">
          <p class="muted">Configured public MCP servers and their tools are shared across workspaces.</p>
          <button id="refreshMcp" class="text-button" type="button">Refresh tool list <span aria-hidden="true">↻</span></button>
          <p id="mcpStatus" class="mcp-status-copy" role="status"></p>
          <ul id="mcpTools" class="mcp-tools"></ul>
        </div>
      </details>

      <footer class="sidebar-footer">
        <button id="settingsButton" class="sidebar-settings-button" type="button"><span class="settings-gear" aria-hidden="true">⚙</span><span>Settings</span><span class="settings-arrow" aria-hidden="true">↗</span></button>
        <span class="sidebar-model-note">Powered by Pi Durable · ${modelName}</span>
      </footer>
    </aside>

    <section class="workspace-main" aria-label="Workspace conversation">
      <header class="chat-header">
        <div class="chat-heading"><p class="eyebrow">Current workspace</p><h1 id="workspaceTitle" class="chat-workspace-title">MultiPerson Chat</h1><p class="chat-subtitle">A place for everyone in this workspace to think together.</p></div>
        <div class="header-status"><span class="connection-pill"><span class="connection-dot" aria-hidden="true"></span><span id="status" role="status">Connecting…</span></span></div>
      </header>

      <section class="chat card" aria-label="Workspace chat">
        <div id="messages" class="messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
        <form id="composerForm" class="composer">
          <div class="compose-card">
            <label class="sr-only" for="composer">Message</label>
            <textarea id="composer" rows="3" placeholder="Write a message to your workspace…" maxlength="4000"></textarea>
            <div class="compose-toolbar">
              <div class="compose-meta"><span class="model-chip composer-model" title="${modelId}"><span class="model-dot" aria-hidden="true"></span>${modelName}</span><span class="compose-hint">Choose who should receive your message</span></div>
              <div class="actions"><button id="sendGroup" class="secondary" type="button"><span class="button-icon" aria-hidden="true">↗</span>Send to group</button><button id="sendAgent" type="button"><span class="button-icon" aria-hidden="true">✦</span>Ask Agent</button></div>
            </div>
          </div>
          <p class="composer-footnote"><span>Messages are visible to everyone with this share link.</span><span>Enter a message, then choose a destination</span></p>
        </form>
        <p id="error" class="error" role="alert"></p>
      </section>
    </section>
  </main>

  <dialog id="settingsDialog" class="settings-dialog" aria-labelledby="settingsTitle">
    <div class="settings-modal">
      <header class="settings-header"><div><p class="eyebrow">Workspace controls</p><h2 id="settingsTitle">Settings</h2><p class="muted">Manage your local workspace list, shared rooms, and MCP connectors.</p></div><button id="closeSettings" class="settings-close" type="button" aria-label="Close settings">×</button></header>
      <section class="settings-section settings-gate-section">
        <div class="settings-section-heading"><span class="section-icon" aria-hidden="true">⌑</span><div><h3>Admin access</h3><p class="muted">Enter the Worker’s admin secret to manage all workspaces and shared tools.</p></div></div>
        <form id="mainUnlockForm" class="settings-unlock-form">
          <label for="mainAdminSecret">Admin secret<input id="mainAdminSecret" type="password" autocomplete="current-password" required placeholder="Enter the admin secret" /></label>
          <button type="submit">Unlock controls <span aria-hidden="true">→</span></button>
        </form>
        <div class="settings-gate-actions"><p id="mainGateStatus" class="admin-status" role="status">Guest workspace links are public bearer links. Admin controls are secret-protected.</p><button id="lockAdmin" class="text-button hidden" type="button">Lock admin controls</button></div>
      </section>
      <div id="mainAdminContent" class="hidden">
        <section class="settings-section">
          <div class="settings-section-heading"><span class="section-icon" aria-hidden="true">▦</span><div><h3>All workspaces</h3><p class="muted">Create a room with an automatic title, copy its share link, or delete it.</p></div></div>
          <button id="createWorkspace" type="button">Create workspace <span aria-hidden="true">+</span></button>
          <p id="mainWorkspaceStatus" class="admin-status" role="status"></p>
          <ul id="settingsWorkspaces" class="settings-list"></ul>
          <p class="admin-note warning-note">Deleting a workspace permanently removes its conversation and scheduled work. Its share link stops working.</p>
        </section>
        <section class="settings-section">
          <div class="settings-section-heading"><span class="section-icon" aria-hidden="true">⌘</span><div><h3>Shared MCP connectors</h3><p class="muted">Add up to eight public HTTPS Streamable HTTP servers, shared by all workspaces.</p></div></div>
          <form id="mainMcpForm" class="settings-mcp-form">
            <label>Server name<input id="mainMcpName" maxlength="80" required placeholder="e.g. Cloudflare docs" /></label>
            <label>MCP endpoint URL<input id="mainMcpUrl" type="url" inputmode="url" required placeholder="https://mcp.example.com/mcp" maxlength="2048" /></label>
            <button type="submit">Add connector <span aria-hidden="true">+</span></button>
          </form>
          <p id="mainMcpStatus" class="admin-status" role="status"></p>
          <ul id="settingsMcpServers" class="settings-list"></ul>
          <p class="admin-note">OAuth and private endpoints are not supported. Connector configuration is shared across workspaces.</p>
        </section>
      </div>
      <p class="settings-guest-note">Without an account, guest workspace history is saved only in this browser. Open a workspace’s share link here to add it to the list.</p>
    </div>
  </dialog>
`;
}
