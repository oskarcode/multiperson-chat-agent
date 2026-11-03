export const adminPage = String.raw`
  <main class="admin-shell">
    <header class="brand admin-header">
      <span class="brand-mark" aria-hidden="true">✦</span>
      <div><h1>Workspace admin</h1><p>Create shareable chat workspaces and connect the shared MCP server.</p></div>
    </header>

    <section id="adminGate" class="card admin-section">
      <form id="unlockForm" class="admin-form">
        <label class="wide">Admin secret<input id="adminSecret" type="password" autocomplete="current-password" required /></label>
        <button type="submit">Unlock admin</button>
      </form>
      <p id="gateStatus" class="admin-status" role="status">Admin controls require the Worker’s ADMIN_SECRET.</p>
    </section>

    <div id="adminContent" class="hidden">
      <section class="card admin-section">
        <h2>Shared MCP server</h2>
        <p class="muted">One public HTTPS Streamable HTTP server is shared with every workspace. OAuth and private endpoints are not supported.</p>
        <form id="mcpForm" class="admin-form">
          <label class="wide">MCP endpoint URL<input id="mcpUrl" type="url" inputmode="url" placeholder="https://mcp.example.com/mcp" maxlength="2048" /></label>
          <button type="submit">Connect and discover tools</button>
          <button id="disconnectMcp" class="secondary" type="button">Disconnect</button>
        </form>
        <p id="mcpStatus" class="admin-status" role="status"></p>
        <ul id="mcpTools" class="admin-tools"></ul>
      </section>

      <section class="card admin-section">
        <h2>Create a workspace</h2>
        <form id="workspaceForm" class="admin-form">
          <label>Workspace name<input id="workspaceTitle" maxlength="80" required placeholder="Project room" /></label>
          <button type="submit">Create and get share link</button>
        </form>
        <p id="workspaceStatus" class="admin-status" role="status"></p>
        <p class="muted">Deleting a workspace permanently removes its conversation and scheduled work; its share link stops working.</p>
        <ul id="workspaces" class="admin-list"></ul>
      </section>
    </div>

    <footer class="footer"><a href="/">Open the chat demo</a></footer>
  </main>
`;
