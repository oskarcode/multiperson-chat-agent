export const adminPage = String.raw`
  <main class="admin-shell">
    <header class="admin-topbar">
      <div class="brand admin-header">
        <span class="brand-mark" aria-hidden="true">✦</span>
        <div><p class="eyebrow">MULTIPERSON CHAT · ADMIN</p><h1>Workspace admin</h1><p>Manage shareable chat rooms and the tools available to their agents.</p></div>
      </div>
      <a class="admin-chat-link" href="/">Open chat demo <span aria-hidden="true">↗</span></a>
    </header>

    <section id="adminGate" class="card admin-section admin-gate">
      <div class="section-heading"><span class="section-icon" aria-hidden="true">⌑</span><div><h2>Admin access</h2><p class="muted">These controls are protected by the Worker’s admin secret.</p></div></div>
      <form id="unlockForm" class="admin-form">
        <label class="wide">Admin secret<input id="adminSecret" type="password" autocomplete="current-password" required placeholder="Enter the admin secret" /></label>
        <button type="submit">Unlock admin <span aria-hidden="true">→</span></button>
      </form>
      <p id="gateStatus" class="admin-status" role="status">Admin controls require the Worker’s ADMIN_SECRET.</p>
    </section>

    <div id="adminContent" class="hidden">
      <div class="admin-intro"><div><p class="eyebrow">CONFIGURATION</p><h2>Shared workspace services</h2></div><p class="muted">One public MCP connection can be used by every workspace. Guest links grant read and write access.</p></div>
      <div class="admin-grid">
        <section class="card admin-section mcp-admin-section">
          <div class="section-heading"><span class="section-icon" aria-hidden="true">⌘</span><div><h2>MCP connectors</h2><p class="muted">Add up to eight public HTTPS Streamable HTTP servers.</p></div></div>
          <form id="mcpForm" class="admin-form mcp-form">
            <label>Server name<input id="mcpName" maxlength="80" required placeholder="e.g. Cloudflare docs" /></label>
            <label>MCP endpoint URL<input id="mcpUrl" type="url" inputmode="url" required placeholder="https://mcp.example.com/mcp" maxlength="2048" /></label>
            <button class="wide" type="submit">Add server <span aria-hidden="true">+</span></button>
          </form>
          <p id="mcpStatus" class="admin-status" role="status"></p>
          <ul id="mcpServers" class="admin-list mcp-server-list"></ul>
          <p class="admin-note">OAuth and private endpoints are not supported. Connected servers and their tools are shared with every workspace.</p>
        </section>

        <section class="card admin-section workspaces-admin-section">
          <div class="section-heading"><span class="section-icon" aria-hidden="true">▦</span><div><h2>Workspaces</h2><p class="muted">Create a room and share its public link with guests.</p></div></div>
          <form id="workspaceForm" class="admin-form workspace-create-form">
            <label class="wide">Workspace name<input id="workspaceTitle" maxlength="80" required placeholder="e.g. Product planning" /></label>
            <button type="submit">Create workspace <span aria-hidden="true">+</span></button>
          </form>
          <p id="workspaceStatus" class="admin-status" role="status"></p>
          <div class="workspace-list-heading"><span>Workspace links</span><span class="muted">Public access</span></div>
          <ul id="workspaces" class="admin-list"></ul>
          <p class="admin-note warning-note">Deleting a workspace permanently removes its conversation and scheduled work. Its share link stops working.</p>
        </section>
      </div>
    </div>

    <footer class="admin-footer"><span>Pi Durable keeps each room’s transcript and scheduled work in its own Durable Object.</span><a href="/">Back to the chat demo</a></footer>
  </main>
`;
