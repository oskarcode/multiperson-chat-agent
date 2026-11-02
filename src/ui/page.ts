export const appPage = String.raw`
  <main class="shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">✦</span><div><h1>MultiPerson Chat</h1><p>Talk together, or bring in the room agent.</p></div></div>
      <div class="room-controls">
        <label>Your name<input id="authorName" maxlength="80" autocomplete="name" /></label>
        <label>Room ID<input id="roomId" maxlength="80" /></label>
        <button id="connectRoom" type="button">Join room</button>
      </div>
    </header>

    <p id="status" class="status" role="status">Connecting…</p>

    <details class="mcp-panel">
      <summary>Public MCP tools <span id="mcpSummary" class="muted">Checking…</span></summary>
      <p class="muted">Set <code>MCP_URL</code> in <code>wrangler.jsonc</code> to try a public Streamable HTTP MCP server.</p>
      <button id="refreshMcp" class="secondary" type="button">Check MCP tools</button>
      <p id="mcpStatus" class="muted" role="status"></p>
      <ul id="mcpTools"></ul>
    </details>

    <section class="chat card" aria-label="Room chat">
      <div id="messages" class="messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
      <div id="progress" class="progress hidden" role="status"></div>
      <form id="composerForm" class="composer">
        <label class="sr-only" for="composer">Message</label>
        <textarea id="composer" rows="3" placeholder="Message your room…" maxlength="4000"></textarea>
        <div class="composer-footer"><span class="muted">Room IDs are public: share one to chat together.</span><div class="actions"><button id="sendGroup" class="secondary" type="button">Send to group</button><button id="sendAgent" type="button">Ask Agent</button></div></div>
      </form>
      <p id="error" class="error" role="alert"></p>
    </section>
    <footer class="footer">Pi Durable keeps each room’s conversation and scheduled work in its own Cloudflare Durable Object.</footer>
  </main>
`;
