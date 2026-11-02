export const appClientScript = String.raw`
    const $ = (id) => document.getElementById(id);
    const state = { roomId: '', name: 'Guest', messages: [], progress: { active: false, partialText: '', tools: [] }, source: null };
    const api = async (path, options = {}) => {
      const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return data;
    };
    const roomPath = (suffix) => '/api/rooms/' + encodeURIComponent(state.roomId) + '/' + suffix;
    function renderMessages() {
      const box = $('messages');
      const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
      box.replaceChildren();
      if (!state.messages.length && !state.progress.partialText) {
        const empty = document.createElement('div'); empty.className = 'empty';
        const text = document.createElement('div'); text.innerHTML = '<strong>Welcome to this room</strong><span>Send a message to everyone, or ask the agent for help.</span>';
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
      const root = $('progress');
      root.replaceChildren();
      if (!state.progress.active) { root.classList.add('hidden'); return; }
      root.classList.remove('hidden');
      const label = document.createElement('span'); label.textContent = state.progress.tools.some((tool) => tool.status === 'running') ? 'Agent is using a tool…' : 'Agent is working…';
      root.append(label);
      const tools = state.progress.tools.filter((tool) => tool.status !== 'done');
      if (tools.length) {
        const list = document.createElement('ul');
        for (const tool of tools) { const item = document.createElement('li'); item.textContent = tool.name + (tool.output ? ': ' + tool.output.slice(-240) : ''); list.append(item); }
        root.append(list);
      }
    }
    async function refreshMcp() {
      $('mcpSummary').textContent = 'Checking…'; $('mcpStatus').textContent = ''; $('mcpTools').replaceChildren();
      try {
        const result = await api(roomPath('mcp'));
        if (!result.configured) { $('mcpSummary').textContent = 'not configured'; $('mcpStatus').textContent = 'Configure MCP_URL in wrangler.jsonc, then restart the Worker.'; return; }
        if (result.error) { $('mcpSummary').textContent = 'connection failed'; $('mcpStatus').textContent = result.error; return; }
        $('mcpSummary').textContent = result.tools.length + ' available';
        $('mcpStatus').textContent = result.tools.length ? 'The agent can call these tools when useful:' : 'Connected, but this server did not advertise tools.';
        for (const tool of result.tools) { const item = document.createElement('li'); item.textContent = (tool.title || tool.name) + (tool.description ? ' — ' + tool.description : ''); $('mcpTools').append(item); }
      } catch (error) { $('mcpSummary').textContent = 'unavailable'; $('mcpStatus').textContent = error.message; }
    }
    function connectRoom() {
      const roomId = $('roomId').value.trim() || 'lobby';
      if (!/^[A-Za-z0-9._-]{1,80}$/u.test(roomId)) { $('error').textContent = 'Use 1–80 letters, numbers, dots, underscores, or hyphens for the room ID.'; return; }
      state.roomId = roomId; state.name = $('authorName').value.trim() || 'Guest';
      localStorage.setItem('chat-room', roomId); localStorage.setItem('chat-name', state.name);
      history.replaceState(null, '', '/?room=' + encodeURIComponent(roomId));
      state.messages = []; state.progress = { active: false, partialText: '', tools: [] }; renderMessages();
      if (state.source) state.source.close();
      $('status').textContent = 'Connecting to room ' + roomId + '…'; $('error').textContent = '';
      const source = new EventSource(roomPath('events')); state.source = source;
      source.onopen = () => { $('status').textContent = 'Connected to public room “' + state.roomId + '”. Share the room ID with others.'; };
      source.onmessage = (event) => {
        try { const snapshot = JSON.parse(event.data); state.messages = snapshot.messages || []; state.progress = snapshot.progress || { active: false, partialText: '', tools: [] }; renderMessages(); }
        catch (error) { $('error').textContent = 'Could not read the room update: ' + error.message; }
      };
      source.onerror = () => { $('status').textContent = 'Room connection interrupted; reconnecting…'; };
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
        if (target === 'agent') $('status').textContent = 'Agent request queued for room “' + state.roomId + '”.';
      } catch (error) { $('error').textContent = error.message; }
      finally { $('sendGroup').disabled = false; $('sendAgent').disabled = false; }
    }
    $('authorName').value = localStorage.getItem('chat-name') || 'Guest';
    $('roomId').value = new URLSearchParams(location.search).get('room') || localStorage.getItem('chat-room') || 'lobby';
    $('connectRoom').onclick = connectRoom;
    $('roomId').addEventListener('keydown', (event) => { if (event.key === 'Enter') connectRoom(); });
    $('authorName').addEventListener('change', () => { state.name = $('authorName').value.trim() || 'Guest'; localStorage.setItem('chat-name', state.name); });
    $('sendGroup').onclick = () => send('group'); $('sendAgent').onclick = () => send('agent');
    $('composerForm').onsubmit = (event) => { event.preventDefault(); send('agent'); };
    $('refreshMcp').onclick = refreshMcp;
    connectRoom();
`;
