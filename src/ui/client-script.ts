export const appClientScript = String.raw`
    const $ = (id) => document.getElementById(id);
    const pathWorkspace = /^\/w\/([A-Za-z0-9._-]{1,80})$/u.exec(location.pathname)?.[1];
    const queryWorkspace = new URLSearchParams(location.search).get('room');
    const state = {
      roomId: pathWorkspace ? decodeURIComponent(pathWorkspace) : queryWorkspace || '',
      name: 'Guest', legacy: !pathWorkspace,
      messages: [], progress: { active: false, partialText: '', tools: [] }, source: null,
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
        const content = document.createElement('div'); content.className = 'message-text';
        if (message.kind === 'agent') { content.classList.add('markdown'); renderAgentMarkdown(content, message.text); }
        else content.textContent = message.text;
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
    function connectWorkspace() {
      state.name = $('authorName').value.trim() || 'Guest';
      if (!state.roomId) {
        $('status').textContent = 'Open a workspace share link to join, or ask the admin to create one at /admin.';
        $('composer').disabled = true; $('sendGroup').disabled = true; $('sendAgent').disabled = true;
        return;
      }
      $('composer').disabled = false; $('sendGroup').disabled = false; $('sendAgent').disabled = false;
      $('status').textContent = 'Connecting to the shared workspace…'; $('error').textContent = '';
      const source = new EventSource(roomPath('events')); state.source = source;
      source.onopen = () => {
        const title = $('workspaceTitle').textContent === 'MultiPerson Chat' ? 'workspace' : '“' + $('workspaceTitle').textContent + '”';
        $('status').textContent = 'Connected to public ' + title + '. Anyone with this link can read and post.';
      };
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
        if (target === 'agent') $('status').textContent = 'Agent request queued.';
      } catch (error) { $('error').textContent = error.message; }
      finally { $('sendGroup').disabled = false; $('sendAgent').disabled = false; }
    }
    $('authorName').value = localStorage.getItem('chat-name') || 'Guest';
    $('authorName').addEventListener('input', () => {
      state.name = $('authorName').value.trim() || 'Guest';
      localStorage.setItem('chat-name', state.name);
    });
    $('sendGroup').onclick = () => send('group'); $('sendAgent').onclick = () => send('agent');
    $('composerForm').onsubmit = (event) => { event.preventDefault(); send('agent'); };
    $('refreshMcp').onclick = refreshMcp;
    connectWorkspace();
`;
