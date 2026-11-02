export const appClientScript = String.raw`
    const $ = (id) => document.getElementById(id);
    const pathWorkspace = /^\/w\/([A-Za-z0-9._-]{1,80})$/u.exec(location.pathname)?.[1];
    const state = { roomId: '', name: 'Guest', legacy: !pathWorkspace, messages: [], progress: { active: false, partialText: '', tools: [] }, source: null };
    const api = async (path, options = {}) => {
      const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return data;
    };
    const roomPath = (suffix) => (state.legacy ? '/api/rooms/' : '/api/workspaces/') + encodeURIComponent(state.roomId) + '/' + suffix;
    function renderMessages() {
      const box = $('messages');
      const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
      box.replaceChildren();
      if (!state.messages.length && !state.progress.partialText) {
        const empty = document.createElement('div'); empty.className = 'empty';
        const text = document.createElement('div'); text.innerHTML = '<strong>Welcome to this workspace</strong><span>Send a message to everyone, or ask the agent for help.</span>';
        empty.append(text); box.append(empty);
      }
      const messages = [...state.messages];
      if (state.progress.partialText) messages.push({ id: 'agent-streaming', authorName: 'Group Agent', kind: 'agent', text: state.progress.partialText, streaming: true });
      for (const message of messages) {
        const item = document.createElement('article');
        item.className = 'message ' + message.kind + (message.streaming ? ' streaming' : '') + (message.authorName === state.name ? ' mine' : '');
        const name = document.createElement('div'); name.className = 'byline'; name.textContent = message.authorName;
        const content = document.createElement('div'); content.className = 'message-text'; content.textContent = message.text;
        item.append(name, content); box.append(item);
      }
      if (nearBottom) box.scrollTop = box.scrollHeight;
      renderProgress();
    }
    function renderProgress() {
      const panel = $('activityPanel');
      const root = $('progress');
      root.replaceChildren();
      const tools = state.progress.tools || [];
      const partialText = state.progress.partialText || '';
      const hasActivity = state.progress.active || partialText || tools.length;
      panel.classList.toggle('hidden', !hasActivity);
      if (!hasActivity) { $('activitySummary').textContent = 'Idle'; return; }
      const runningTool = tools.some((tool) => tool.status === 'running');
      $('activitySummary').textContent = state.progress.active ? (runningTool ? 'Using a tool' : 'Streaming') : 'Latest turn';
      const label = document.createElement('div');
      label.textContent = state.progress.active ? (runningTool ? 'Agent is using a tool…' : 'Agent is working…') : 'Agent turn finished.';
      root.append(label);
      if (partialText) {
        const text = document.createElement('div'); text.className = 'partial';
        text.textContent = partialText.slice(-1600); root.append(text);
      }
      if (tools.length) {
        const list = document.createElement('ul');
        for (const tool of tools.slice(-8)) {
          const item = document.createElement('li');
          item.textContent = tool.name + ' · ' + tool.status + (tool.output ? ': ' + tool.output.slice(-300) : '');
          list.append(item);
        }
        root.append(list);
      }
    }
    async function refreshMcp() {
      $('mcpSummary').textContent = 'Checking…'; $('mcpStatus').textContent = ''; $('mcpTools').replaceChildren();
      try {
        const result = await api(roomPath('mcp'));
        if (!result.configured) { $('mcpSummary').textContent = 'not connected'; $('mcpStatus').textContent = 'The admin can connect a shared public MCP server at /admin.'; return; }
        if (result.error) { $('mcpSummary').textContent = 'connection failed'; $('mcpStatus').textContent = result.error; return; }
        $('mcpSummary').textContent = result.tools.length + ' available';
        $('mcpStatus').textContent = result.tools.length ? 'Shared with every workspace; the agent can call these tools when useful:' : 'Connected, but this server did not advertise tools.';
        for (const tool of result.tools) { const item = document.createElement('li'); item.textContent = (tool.title || tool.name) + (tool.description ? ' — ' + tool.description : ''); $('mcpTools').append(item); }
      } catch (error) { $('mcpSummary').textContent = 'unavailable'; $('mcpStatus').textContent = error.message; }
    }
    function connectRoom() {
      const roomId = $('roomId').value.trim();
      if (!/^[A-Za-z0-9._-]{1,80}$/u.test(roomId)) { $('error').textContent = 'Use 1–80 letters, numbers, dots, underscores, or hyphens for the workspace ID.'; return; }
      state.roomId = roomId; state.name = $('authorName').value.trim() || 'Guest';
      localStorage.setItem('chat-room', roomId); localStorage.setItem('chat-name', state.name);
      history.replaceState(null, '', state.legacy ? '/?room=' + encodeURIComponent(roomId) : '/w/' + encodeURIComponent(roomId));
      state.messages = []; state.progress = { active: false, partialText: '', tools: [] }; renderMessages();
      if (state.source) state.source.close();
      $('status').textContent = 'Connecting to workspace ' + roomId + '…'; $('error').textContent = '';
      const source = new EventSource(roomPath('events')); state.source = source;
      source.onopen = () => { $('status').textContent = 'Connected to public workspace “' + state.roomId + '”. Share this URL with guests; no sign-in is needed.'; };
      source.onmessage = (event) => {
        try {
          const snapshot = JSON.parse(event.data);
          state.messages = snapshot.messages || [];
          state.progress = snapshot.progress || { active: false, partialText: '', tools: [] };
          if (snapshot.workspace?.title) $('workspaceTitle').textContent = snapshot.workspace.title;
          renderMessages();
        } catch (error) { $('error').textContent = 'Could not read the workspace update: ' + error.message; }
      };
      source.onerror = () => { $('status').textContent = 'Workspace connection interrupted; reconnecting…'; };
      refreshMcp();
    }
    async function send(target) {
      const text = $('composer').value.trim();
      if (!text || !state.roomId) return;
      $('error').textContent = '';
      $('sendGroup').disabled = true; $('sendAgent').disabled = true;
      try {
        await api(roomPath('messages'), { method: 'POST', body: JSON.stringify({ authorName: state.name, text, target, requestId: crypto.randomUUID() }) });
        $('composer').value = '';
        if (target === 'agent') $('status').textContent = 'Agent request queued for workspace “' + state.roomId + '”.';
      } catch (error) { $('error').textContent = error.message; }
      finally { $('sendGroup').disabled = false; $('sendAgent').disabled = false; }
    }
    $('authorName').value = localStorage.getItem('chat-name') || 'Guest';
    $('roomId').value = pathWorkspace ? decodeURIComponent(pathWorkspace) : new URLSearchParams(location.search).get('room') || localStorage.getItem('chat-room') || 'lobby';
    $('connectRoom').onclick = connectRoom;
    $('roomId').addEventListener('keydown', (event) => { if (event.key === 'Enter') connectRoom(); });
    $('authorName').addEventListener('change', () => { state.name = $('authorName').value.trim() || 'Guest'; localStorage.setItem('chat-name', state.name); });
    $('sendGroup').onclick = () => send('group'); $('sendAgent').onclick = () => send('agent');
    $('composerForm').onsubmit = (event) => { event.preventDefault(); send('agent'); };
    $('refreshMcp').onclick = refreshMcp;
    connectRoom();
`;
