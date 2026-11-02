export const appPage = String.raw`
  <main class="shell">
    <section class="hero">
      <h1>MultiPerson Chat</h1>
      <p>A private AI group chat for your group, self-deployed to your Cloudflare account.</p>
      <p id="status" class="muted">Loading…</p>
    </section>

    <section id="auth" class="auth hidden">
      <div class="card story">
        <p class="muted">A private space for your group</p>
        <h2>Your group's AI space, owned by you.</h2>
        <p>Create your group, share an invite, and start chatting. Your group hosts this space in its own Cloudflare account.</p>
        <div class="pill-list">
          <div class="pill">💬 <div><strong>Human chat first.</strong><br><span class="muted">Talk to your group in shared rooms.</span></div></div>
          <div class="pill">🤖 <div><strong>Resident Group Agent.</strong><br><span class="muted">Ask Agent when you want help.</span></div></div>
          <div class="pill">🔐 <div><strong>Easy to join.</strong><br><span class="muted">Group members only need an invite link and their name.</span></div></div>
        </div>
      </div>
      <div class="card stack">
        <div class="tabs"><button id="tabSetup" class="active">Create group</button><button id="tabLogin">Sign in</button><button id="tabJoin">Join</button></div>
        <div id="setupForm" class="stack">
          <h2>Create your group space</h2><p class="muted">Set up the first owner account, then invite your chat. No Cloudflare accounts needed for them.</p>
          <label>Your name<input id="setupName" autocomplete="name" /></label>
          <label>Email<input id="setupEmail" type="email" autocomplete="email" /></label>
          <label>Password<input id="setupPassword" placeholder="8+ characters" type="password" autocomplete="new-password" /></label>
          <label>Space name<input id="setupGroupName" placeholder="The Smith group" /></label>
          <button id="setupButton">Create group space</button>
        </div>
        <div id="loginForm" class="stack hidden">
          <h2>Welcome back</h2><p class="muted">Sign in to chat or accept your room invitation.</p>
          <label>Email<input id="loginEmail" type="email" autocomplete="email" /></label>
          <label>Password<input id="loginPassword" type="password" autocomplete="current-password" /></label>
          <button id="loginButton">Sign in</button>
        </div>
        <div id="joinForm" class="stack hidden">
          <h2>You're invited</h2><p class="muted">Enter your name to join this group room. No email or password needed.</p>
          <label>Your name<input id="joinName" autocomplete="name" /></label>
          <label id="joinCodeLabel">Invite code<input id="joinCode" /></label>
          <button id="joinButton">Join room</button>
        </div>
        <p id="authError" class="error"></p>
      </div>
    </section>

    <section id="app" class="grid hidden">
      <aside class="card stack session-sidebar-lite">
        <header class="workspace-brand">
          <span class="workspace-avatar" id="memberAvatar" aria-hidden="true">F</span>
          <span><strong id="groupLabel">MultiPerson Chat</strong><small id="memberLabel">Group workspace</small></span>
        </header>
        <button id="newWorkspaceButton" class="new-workspace-button secondary"><span aria-hidden="true">＋</span> New room</button>
        <input id="newWorkspace" class="compact-input" placeholder="Room name" />
        <nav class="sidebar-section" aria-labelledby="roomsHeading"><div class="sidebar-label-row"><h2 id="roomsHeading">Rooms</h2><span id="roomCount">0</span></div><div id="workspaces" class="nav-list"></div></nav>
        <section class="sidebar-section"><div class="sidebar-label-row"><h2>Group</h2></div><div id="members" class="people-list-lite"></div></section>
        <footer class="session-sidebar-footer-lite"><button id="settingsButton" class="settings-launcher secondary small-button" type="button"><span aria-hidden="true">⚙</span> Settings</button><small id="signedInLabel">Signed in</small><button id="logoutButton" class="secondary small-button">Logout</button></footer>
      </aside>
      <section class="card stack conversation-view-lite">
        <div id="pendingInvite" class="card hidden"><p>You have an invitation to a room.</p><button id="acceptInviteButton">Join invited room</button><p id="inviteError" role="alert"></p></div>
        <header class="conversation-header-lite"><div><small>Current room</small><h2 id="roomTitle">General room</h2></div><div class="room-actions"><p class="muted">Send to everyone, or ask the resident Group Agent.</p><button id="roomInviteButton" class="secondary small-button" type="button">Invite group</button><button id="manageInvitesButton" class="secondary small-button" type="button">Manage invites</button><div id="roomInviteResult" class="muted"></div></div></header>
        <div id="messages" class="messages"></div>
        <form class="prompt-bar" id="composerForm"><textarea id="composer" placeholder="Start a new message…"></textarea><div class="composer-footer"><span class="composer-status" id="modelLabel">Workers AI · open-weight model</span><div class="composer-actions"><button id="sendGroup" class="send-group-button" type="button">Send to Group</button><button id="sendAgent" class="ask-agent-button agent" type="button">Ask Agent</button></div></div></form>
        <p id="chatError" class="error"></p>
      </section>
      <div id="settingsBackdrop" class="settings-backdrop"></div>
      <aside class="card stack connections-panel" role="dialog" aria-modal="true" aria-labelledby="settingsHeading">
        <header class="settings-header"><div><small>MultiPerson Chat</small><h2 id="settingsHeading">Settings</h2></div><button id="settingsClose" class="settings-close" type="button" aria-label="Close settings">×</button></header>
        <nav class="settings-tabs" aria-label="Settings sections"><button id="settingsTabTools" class="active" type="button">Tools</button><button id="settingsTabCalendar" type="button">Calendar</button><button id="settingsTabAccount" type="button">Account</button></nav>
        <div id="settingsViewTools" class="settings-panel-view stack">
          <section class="settings-section-card"><h2>Agent model</h2><p class="muted">Choose a Workers AI open-weight model, or bring your own Anthropic key for Claude.</p><select id="aiProvider"><option value="workers-ai">Workers AI</option><option value="anthropic">Anthropic / Claude</option></select><select id="aiModel"></select><input id="anthropicKey" type="password" placeholder="Anthropic API key (only for Claude)" /><button id="aiSettingsButton" class="secondary">Save model</button><p id="aiSettingsResult" class="muted"></p></section>
          <section class="settings-section-card"><h2>Skills</h2><p class="muted">Create small Group Agent skills stored in this Durable Object filesystem.</p><div id="skills" class="stack"></div><input id="skillTitle" placeholder="Skill title, e.g. Meal planner" /><textarea id="skillDescription" placeholder="What should this skill help with?"></textarea><button id="skillButton" class="secondary">Create skill</button><p id="skillError" class="error"></p></section>
          <section class="settings-section-card"><h2>Connections</h2><p class="muted">Connect Streamable HTTP MCP services for group tools.</p><div id="connectors" class="stack"></div><input id="connectorLabel" placeholder="Label, e.g. Gmail MCP" /><input id="connectorUrl" placeholder="https://mcp.example.com/mcp" /><button id="connectorButton" class="secondary">Add connector</button><p id="connectorError" class="error"></p></section>
        </div>
        <div id="settingsViewCalendar" class="settings-panel-view stack hidden">
          <section class="settings-section-card"><h2>Schedule calendar</h2><p class="muted">Schedules are saved as Pi Durable tasks. Background delivery is still being migrated; tasks currently do not send the reminder when they reach their scheduled time.</p><div class="calendar-toolbar"><label class="stack"><span class="muted">Room</span><select id="scheduleWorkspace"></select></label><button id="refreshCalendarButton" class="secondary" type="button">Refresh</button></div><input id="scheduleInstruction" placeholder="What should happen? e.g. Review tomorrow's school pickup" /><input id="scheduleRunAt" type="datetime-local" /><button id="scheduleButton" class="secondary" type="button">Create schedule</button><p id="scheduleError" class="error"></p><div id="scheduleList" class="schedule-list"></div></section>
        </div>
        <div id="settingsViewAccount" class="settings-panel-view stack hidden">
          <section class="settings-section-card"><h2>Account</h2><div class="row"><span class="workspace-avatar" id="accountAvatar" aria-hidden="true">F</span><span><strong id="accountName">Group member</strong><br><span id="accountEmail" class="muted"></span></span></div></section>
        </div>
      </aside>
    </section>
  </main>
`;
