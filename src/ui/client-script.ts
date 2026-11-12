export const appClientScript = String.raw`
    const $ = (id) => document.getElementById(id);
    const pathWorkspace = /^\/w\/([A-Za-z0-9._-]{1,80})$/u.exec(location.pathname)?.[1];
    const queryWorkspace = new URLSearchParams(location.search).get('room');
    const state = {
      roomId: pathWorkspace ? decodeURIComponent(pathWorkspace) : queryWorkspace || '',
      name: 'Guest', legacy: !pathWorkspace,
      messages: [], progress: { active: false, phase: 'idle', partialText: '', tools: [] },
      currentActivity: [], activityByMessage: new Map(), activityOpenByKey: new Map(), activeMessageId: null, snapshotReceived: false,
      socket: null, reconnectTimer: null, reconnectDelay: 500, pending: new Map(),
    };
    const api = async (path, options = {}) => {
      const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return data;
    };
    const roomPath = (suffix) => (state.legacy ? '/api/rooms/' : '/api/workspaces/') + encodeURIComponent(state.roomId) + '/' + suffix;
    function appendInlineMarkdown(parent, text) {
      const tokenPattern = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\x60[^\x60]+\x60|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/gu;
      let offset = 0;
      for (const match of text.matchAll(tokenPattern)) {
        const token = match[0];
        const start = match.index ?? 0;
        if (start > offset) parent.append(document.createTextNode(text.slice(offset, start)));
        if (token.startsWith('[')) {
          const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/u.exec(token);
          if (link) {
            try {
              const url = new URL(link[2]);
              if (url.protocol === 'http:' || url.protocol === 'https:') {
                const anchor = document.createElement('a');
                anchor.href = url.href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = link[1];
                parent.append(anchor);
              } else parent.append(document.createTextNode(token));
            } catch { parent.append(document.createTextNode(token)); }
          } else parent.append(document.createTextNode(token));
        } else if (token.startsWith(String.fromCharCode(96))) {
          const code = document.createElement('code'); code.textContent = token.slice(1, -1); parent.append(code);
        } else if (token.startsWith('**') || token.startsWith('__')) {
          const strong = document.createElement('strong'); strong.textContent = token.slice(2, -2); parent.append(strong);
        } else {
          const emphasis = document.createElement('em'); emphasis.textContent = token.slice(1, -1); parent.append(emphasis);
        }
        offset = start + token.length;
      }
      if (offset < text.length) parent.append(document.createTextNode(text.slice(offset)));
    }
    function renderAgentMarkdown(parent, text) {
      const lines = text.split(/\r?\n/u);
      let paragraph = [];
      let list = null;
      let codeLines = null;
      const flushParagraph = () => {
        if (!paragraph.length) return;
        const node = document.createElement('p'); appendInlineMarkdown(node, paragraph.join(' ')); parent.append(node); paragraph = [];
      };
      const flushList = () => { if (list) { parent.append(list); list = null; } };
      const flushCode = () => {
        const pre = document.createElement('pre'); const code = document.createElement('code');
        code.textContent = codeLines.join('\n'); pre.append(code); parent.append(pre); codeLines = null;
      };
      for (const line of lines) {
        if (codeLines) {
          if (/^\s*\x60{3}\s*$/u.test(line)) flushCode();
          else codeLines.push(line);
          continue;
        }
        if (/^\s*\x60{3}[\w-]*\s*$/u.test(line)) {
          flushParagraph(); flushList(); codeLines = []; continue;
        }
        if (!line.trim()) { flushParagraph(); flushList(); continue; }
        const heading = /^(#{1,3})\s+(.+)$/u.exec(line);
        if (heading) {
          flushParagraph(); flushList();
          const node = document.createElement('h' + heading[1].length); appendInlineMarkdown(node, heading[2]); parent.append(node); continue;
        }
        const quote = /^>\s?(.*)$/u.exec(line);
        if (quote) {
          flushParagraph(); flushList();
          const node = document.createElement('blockquote'); appendInlineMarkdown(node, quote[1]); parent.append(node); continue;
        }
        const item = /^\s*(?:[-*+]\s+|\d+[.)]\s+)(.*)$/u.exec(line);
        if (item) {
          flushParagraph();
          const ordered = /^\s*\d/u.test(line);
          if (!list || list.tagName === 'OL' !== ordered) { flushList(); list = document.createElement(ordered ? 'ol' : 'ul'); }
          const node = document.createElement('li'); appendInlineMarkdown(node, item[1]); list.append(node); continue;
        }
        flushList(); paragraph.push(line.trim());
      }
      if (codeLines) flushCode();
      flushParagraph(); flushList();
    }
    function addActivity(text) {
      if (!text) return;
      state.currentActivity.push(text);
      if (state.currentActivity.length > 12) state.currentActivity.shift();
    }
    function recordActivity(nextProgress, nextMessages) {
      const previous = state.progress;
      const previousAnswerIds = new Set(state.messages.filter((message) => message.kind === 'agent').map((message) => message.id));
      if (!previous.active && nextProgress.active) {
        state.currentActivity = [];
        state.activeMessageId = null;
        addActivity(state.snapshotReceived ? 'Agent started' : 'Agent is working');
      }
      if (nextProgress.active && previous.phase !== nextProgress.phase && nextProgress.phase !== 'starting') {
        const phaseMessages = {
          starting: 'Agent is starting',
          responding: 'Agent is preparing a response',
          'using-tools': 'Agent is using tools',
          waiting: 'Agent is waiting for a response',
          retrying: 'Agent is retrying',
        };
        addActivity(phaseMessages[nextProgress.phase] || 'Agent is working');
      }
      const oldTools = new Map((previous.tools || []).map((tool) => [tool.id || tool.name, tool]));
      for (const tool of nextProgress.tools || []) {
        const old = oldTools.get(tool.id || tool.name);
        if (old?.status === tool.status) continue;
        if (tool.status === 'pending') addActivity('Tool queued: ' + tool.name);
        else if (tool.status === 'running') addActivity('Calling tool: ' + tool.name);
        else addActivity('Tool completed: ' + tool.name);
      }
      const newAnswer = state.snapshotReceived
        ? [...nextMessages].reverse().find((message) => message.kind === 'agent' && !previousAnswerIds.has(message.id))
        : undefined;
      if (newAnswer && (nextProgress.active || previous.active)) {
        const previousActivityKey = state.activeMessageId || 'agent-live';
        if (state.activityOpenByKey.has(previousActivityKey)) state.activityOpenByKey.set(newAnswer.id, state.activityOpenByKey.get(previousActivityKey));
        state.activeMessageId = newAnswer.id;
      }
      if (previous.active && !nextProgress.active) {
        const receivedAnswer = Boolean(newAnswer || state.activeMessageId);
        addActivity(receivedAnswer ? 'Agent response received' : 'Agent run ended');
      }
      if (state.activeMessageId) state.activityByMessage.set(state.activeMessageId, [...state.currentActivity]);
      const liveMessageIds = new Set(nextMessages.map((message) => message.id));
      for (const id of state.activityByMessage.keys()) if (!liveMessageIds.has(id)) state.activityByMessage.delete(id);
      for (const id of state.activityOpenByKey.keys()) if (id !== 'agent-live' && !liveMessageIds.has(id)) state.activityOpenByKey.delete(id);
      if (!nextProgress.active) {
        state.activeMessageId = null;
        state.activityOpenByKey.delete('agent-live');
      }
      state.snapshotReceived = true;
    }
    function appendAgentActivity(parent, events, active = false, key = 'agent-live') {
      if (!events?.length) return;
      const activity = document.createElement('details'); activity.className = 'agent-activity' + (active ? ' active' : '');
      activity.setAttribute('aria-label', active ? 'Live agent activity' : 'Agent activity for this response');
      activity.open = state.activityOpenByKey.has(key) ? state.activityOpenByKey.get(key) : false;
      state.activityOpenByKey.set(key, activity.open);
      activity.addEventListener('toggle', () => state.activityOpenByKey.set(key, activity.open));
      const heading = document.createElement('summary'); heading.className = 'agent-activity-heading';
      const icon = document.createElement('span'); icon.className = 'activity-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = '✳';
      const title = document.createElement('span'); title.textContent = 'Agent activity';
      const status = document.createElement('span'); status.className = 'agent-activity-status'; status.textContent = active ? 'In progress' : 'Steps taken';
      const chevron = document.createElement('span'); chevron.className = 'activity-chevron'; chevron.setAttribute('aria-hidden', 'true'); chevron.textContent = '⌄';
      heading.append(icon, title, status, chevron);
      const list = document.createElement('ol'); list.className = 'activity-events';
      for (const event of events) { const item = document.createElement('li'); item.textContent = event; list.append(item); }
      activity.append(heading, list); parent.append(activity);
    }
    function initials(name) {
      return (name || 'Guest').trim().split(/\s+/u).slice(0, 2).map((part) => Array.from(part)[0]?.toUpperCase() || '').join('') || 'G';
    }
    function renderMessages() {
      const box = $('messages');
      const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
      box.replaceChildren();
      if (!state.messages.length && !state.progress.partialText) {
        const empty = document.createElement('div'); empty.className = 'empty';
        const mark = document.createElement('span'); mark.className = 'empty-mark'; mark.textContent = '✦'; mark.setAttribute('aria-hidden', 'true');
        const title = document.createElement('strong'); title.textContent = 'Start the conversation';
        const description = document.createElement('span'); description.textContent = 'Send a note to everyone here, or ask the agent to help move things forward.';
        const copy = document.createElement('div'); copy.className = 'empty-copy'; copy.append(title, description);
        empty.append(mark, copy); box.append(empty);
      }
      const messages = [...state.messages];
      if (state.progress.partialText) messages.push({ id: 'agent-streaming', authorName: 'Group Agent', kind: 'agent', text: state.progress.partialText, streaming: true });
      for (const message of messages) {
        const item = document.createElement('article');
        item.className = 'message ' + message.kind + (message.streaming ? ' streaming' : '') + (message.authorName === state.name ? ' mine' : '');
        const avatar = document.createElement('span');
        avatar.className = 'speaker-avatar ' + (message.kind === 'agent' ? 'agent-avatar' : message.kind === 'system' ? 'system-avatar' : 'guest-avatar');
        avatar.textContent = message.kind === 'agent' ? '✦' : message.kind === 'system' ? '·' : initials(message.authorName);
        avatar.setAttribute('aria-hidden', 'true');
        const body = document.createElement('div'); body.className = 'message-body';
        const name = document.createElement('div'); name.className = 'byline'; name.textContent = message.authorName;
        const content = document.createElement('div'); content.className = 'message-text';
        if (message.kind === 'agent') { content.classList.add('markdown'); renderAgentMarkdown(content, message.text); }
        else content.textContent = message.text;
        body.append(name, content); item.append(avatar, body); box.append(item);
        if (message.kind === 'agent') {
          const liveActivity = message.streaming && state.progress.active && !state.activeMessageId;
          const events = liveActivity ? state.currentActivity : state.activityByMessage.get(message.id);
          const activityKey = liveActivity ? 'agent-live' : message.id;
          appendAgentActivity(box, events, Boolean(liveActivity), activityKey);
        }
      }
      if (state.progress.active) {
        const thinking = document.createElement('div'); thinking.className = 'agent-thinking'; thinking.setAttribute('role', 'status');
        const avatar = document.createElement('span'); avatar.className = 'speaker-avatar agent-avatar'; avatar.textContent = '✦'; avatar.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = state.progress.phase === 'using-tools' ? 'Group Agent is using tools' : state.progress.phase === 'waiting' ? 'Group Agent is waiting' : 'Group Agent is thinking';
        const dots = document.createElement('span'); dots.className = 'thinking-dots'; dots.setAttribute('aria-hidden', 'true'); dots.textContent = '···';
        thinking.append(avatar, label, dots); box.append(thinking);
        const activityAlreadyShown = Boolean(state.progress.partialText || state.activeMessageId);
        if (!activityAlreadyShown) appendAgentActivity(box, state.currentActivity, true, 'agent-live');
      }
      if (nearBottom) box.scrollTop = box.scrollHeight;
    }
    function setConnectionStatus(message, status = 'connecting') {
      const element = $('status');
      element.textContent = message;
      element.closest('.connection-pill')?.setAttribute('data-state', status);
    }
    async function refreshMcp() {
      $('mcpSummary').textContent = 'Checking…'; $('mcpStatus').textContent = ''; $('mcpTools').replaceChildren();
      try {
        const result = await api(roomPath('mcp'));
        if (!result.configured) { $('mcpSummary').textContent = 'not connected'; $('mcpStatus').textContent = 'The admin can connect public MCP servers at /admin.'; return; }
        const servers = result.servers || [];
        const toolCount = (result.tools || []).length;
        $('mcpSummary').textContent = servers.length + ' server' + (servers.length === 1 ? '' : 's') + ' · ' + toolCount + ' tools';
        const unavailable = servers.filter((server) => server.error).length;
        $('mcpStatus').textContent = unavailable
          ? 'Some server connections are unavailable; other configured tools remain usable.'
          : toolCount ? 'Shared with every workspace; the agent can call these tools when useful.' : 'Connected, but these servers did not advertise tools.';
        for (const server of servers) {
          const group = document.createElement('li'); group.className = 'mcp-server-group';
          const heading = document.createElement('div'); heading.className = 'mcp-server-heading';
          const name = document.createElement('strong'); name.textContent = server.name;
          const count = document.createElement('span'); count.textContent = server.error ? 'unavailable' : server.tools.length + ' tools';
          heading.append(name, count); group.append(heading);
          if (server.error) {
            const error = document.createElement('p'); error.className = 'mcp-server-error'; error.textContent = server.error; group.append(error);
          } else {
            const tools = document.createElement('ul'); tools.className = 'mcp-server-tool-list';
            for (const tool of server.tools) {
              const item = document.createElement('li'); item.textContent = (tool.title || tool.name) + (tool.description ? ' — ' + tool.description : ''); tools.append(item);
            }
            group.append(tools);
          }
          $('mcpTools').append(group);
        }
      } catch (error) { $('mcpSummary').textContent = 'unavailable'; $('mcpStatus').textContent = error.message; }
    }
    function applySnapshot(snapshot) {
      const nextMessages = snapshot.messages || [];
      const nextProgress = snapshot.progress || { active: false, phase: 'idle', partialText: '', tools: [] };
      if (!nextProgress.phase) nextProgress.phase = nextProgress.active ? 'responding' : 'idle';
      nextProgress.tools = (nextProgress.tools || []).map((tool) => ({ ...tool, id: tool.id || tool.name }));
      recordActivity(nextProgress, nextMessages);
      state.messages = nextMessages;
      state.progress = nextProgress;
      if (snapshot.workspace?.title) $('workspaceTitle').textContent = snapshot.workspace.title;
      renderMessages();
    }
    function setSendEnabled() {
      const enabled = Boolean(state.socket && state.socket.readyState === WebSocket.OPEN && state.pending.size === 0);
      $('composer').disabled = !enabled;
      $('sendGroup').disabled = !enabled;
      $('sendAgent').disabled = !enabled;
    }
    function socketPath() {
      return (state.legacy ? '/api/rooms/' : '/api/workspaces/') + encodeURIComponent(state.roomId) + '/socket';
    }
    function connectSocket() {
      if (!state.roomId) {
        setConnectionStatus('Open a workspace share link to join, or ask the admin to create one at /admin.', 'disconnected');
        setSendEnabled();
        return;
      }
      setConnectionStatus('Connecting to the shared workspace…', 'connecting');
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(protocol + '//' + location.host + socketPath());
      state.socket = socket;
      setSendEnabled();
      socket.onopen = () => {
        if (state.socket !== socket) return;
        state.reconnectDelay = 500;
        const title = $('workspaceTitle').textContent === 'MultiPerson Chat' ? 'workspace' : '“' + $('workspaceTitle').textContent + '”';
        setConnectionStatus('Connected to public ' + title + '. Anyone with this link can read and post.', 'connected');
        setSendEnabled();
        for (const pending of state.pending.values()) socket.send(JSON.stringify(pending));
      };
      socket.onmessage = (event) => {
        if (state.socket !== socket) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'snapshot') { applySnapshot(message.snapshot); return; }
          if (message.type === 'ack' && typeof message.requestId === 'string') {
            const pending = state.pending.get(message.requestId);
            if (!pending) return;
            state.pending.delete(message.requestId);
            if ($('composer').value.trim() === pending.text) $('composer').value = '';
            if (pending.target === 'agent') setConnectionStatus('Agent request queued.', 'connected');
            setSendEnabled();
            return;
          }
          if (message.type === 'error') {
            if (typeof message.requestId === 'string') state.pending.delete(message.requestId);
            $('error').textContent = message.error || 'The workspace could not process that message.';
            setSendEnabled();
          }
        } catch (error) { $('error').textContent = 'Could not read the workspace update: ' + error.message; }
      };
      socket.onerror = () => { if (state.socket === socket) setConnectionStatus('Workspace connection interrupted; reconnecting…', 'reconnecting'); };
      socket.onclose = () => {
        if (state.socket !== socket) return;
        setSendEnabled();
        setConnectionStatus('Workspace connection interrupted; reconnecting…', 'reconnecting');
        if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
        const delay = state.reconnectDelay;
        state.reconnectDelay = Math.min(state.reconnectDelay * 2, 10_000);
        state.reconnectTimer = setTimeout(connectSocket, delay);
      };
    }
    function connectWorkspace() {
      state.name = $('authorName').value.trim() || 'Guest';
      $('error').textContent = '';
      connectSocket();
      refreshMcp();
    }
    function send(target) {
      const text = $('composer').value.trim();
      if (!text || !state.roomId || !state.socket || state.socket.readyState !== WebSocket.OPEN || state.pending.size) return;
      $('error').textContent = '';
      const requestId = crypto.randomUUID();
      const pending = { type: 'send', requestId, authorName: state.name, text, target };
      state.pending.set(requestId, pending);
      setSendEnabled();
      try { state.socket.send(JSON.stringify(pending)); }
      catch (error) { $('error').textContent = error.message; }
    }
    $('authorName').value = localStorage.getItem('chat-name') || 'Guest';
    state.name = $('authorName').value.trim() || 'Guest';
    document.querySelector('.profile-avatar').textContent = initials(state.name);
    $('authorName').addEventListener('input', () => {
      state.name = $('authorName').value.trim() || 'Guest';
      document.querySelector('.profile-avatar').textContent = initials(state.name);
      localStorage.setItem('chat-name', state.name);
    });
    $('sendGroup').onclick = () => send('group'); $('sendAgent').onclick = () => send('agent');
    $('composerForm').onsubmit = (event) => { event.preventDefault(); send('agent'); };
    $('refreshMcp').onclick = refreshMcp;
    connectWorkspace();
`;
