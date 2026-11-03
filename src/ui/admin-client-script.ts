export const adminClientScript = String.raw`
  const $ = (id) => document.getElementById(id);
  const secretKey = 'workspace-admin-secret';
  let secret = sessionStorage.getItem(secretKey) || '';
  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + secret, ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Admin request failed.');
    return data;
  };
  function status(element, message, error = false) {
    element.textContent = message;
    element.classList.toggle('admin-error', error);
  }
  function renderTools(tools) {
    $('mcpTools').replaceChildren();
    for (const tool of tools || []) {
      const item = document.createElement('li');
      item.textContent = (tool.title || tool.name) + (tool.description ? ' — ' + tool.description : '');
      $('mcpTools').append(item);
    }
  }
  function renderWorkspaces(workspaces) {
    const list = $('workspaces');
    list.replaceChildren();
    if (!workspaces.length) {
      const empty = document.createElement('li'); empty.className = 'muted'; empty.textContent = 'No workspaces yet.'; list.append(empty); return;
    }
    for (const workspace of workspaces) {
      const item = document.createElement('li'); item.className = 'admin-item';
      const link = document.createElement('a'); link.href = '/w/' + encodeURIComponent(workspace.id); link.textContent = workspace.title + (workspace.deleting ? ' (deletion pending)' : '');
      const linkWrap = document.createElement('div');
      const share = location.origin + link.href;
      const url = document.createElement('div'); url.className = 'muted'; url.textContent = workspace.deleting ? 'Access is disabled. Retry cleanup below.' : share;
      linkWrap.append(link, url);
      const actions = document.createElement('div'); actions.className = 'admin-item-actions';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'secondary'; copy.textContent = 'Copy share URL'; copy.disabled = Boolean(workspace.deleting);
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(share); status($('workspaceStatus'), 'Share URL copied.'); }
        catch { status($('workspaceStatus'), 'Copy failed; select and copy the URL shown.'); }
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = workspace.deleting ? 'Retry deletion' : 'Delete workspace';
      remove.addEventListener('click', async () => {
        if (!workspace.deleting && !window.confirm('Permanently delete “' + workspace.title + '”? Its messages, scheduled work, and share link will be removed.')) return;
        remove.disabled = true;
        status($('workspaceStatus'), workspace.deleting ? 'Retrying workspace cleanup…' : 'Deleting workspace and stored chat…');
        try {
          await api('/api/admin/workspaces/' + encodeURIComponent(workspace.id), { method: 'DELETE' });
          status($('workspaceStatus'), 'Workspace deleted. Its share link no longer works.');
        } catch (error) {
          status($('workspaceStatus'), 'Deletion is incomplete: ' + error.message, true);
        } finally { await refresh(); }
      });
      actions.append(copy, remove); item.append(linkWrap, actions); list.append(item);
    }
  }
  async function refresh() {
    try {
      const data = await api('/api/admin/state');
      $('adminGate').classList.add('hidden'); $('adminContent').classList.remove('hidden');
      renderWorkspaces(data.workspaces);
      $('mcpUrl').value = data.mcp.url || '';
      renderTools(data.mcp.tools);
      status($('mcpStatus'), data.mcp.error || (data.mcp.configured ? data.mcp.tools.length + ' MCP tools available to all workspaces.' : 'No shared MCP server connected.'), Boolean(data.mcp.error));
    } catch (error) {
      secret = ''; sessionStorage.removeItem(secretKey);
      $('adminContent').classList.add('hidden'); $('adminGate').classList.remove('hidden');
      status($('gateStatus'), error.message, true);
    }
  }
  $('unlockForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    secret = $('adminSecret').value;
    sessionStorage.setItem(secretKey, secret);
    $('adminSecret').value = '';
    await refresh();
  });
  $('workspaceForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('workspaceForm').querySelector('button'); button.disabled = true;
    try {
      const data = await api('/api/admin/workspaces', { method: 'POST', body: JSON.stringify({ title: $('workspaceTitle').value }) });
      $('workspaceTitle').value = '';
      status($('workspaceStatus'), 'Workspace created. Share its link with guests; they do not need to sign in.');
      await refresh();
      const link = $('workspaces').querySelector('a[href="/w/' + data.workspace.id + '"]');
      link?.focus();
    } catch (error) { status($('workspaceStatus'), error.message, true); }
    finally { button.disabled = false; }
  });
  $('mcpForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('mcpForm').querySelector('button[type="submit"]'); button.disabled = true;
    status($('mcpStatus'), 'Connecting and discovering tools…'); renderTools([]);
    try {
      const data = await api('/api/admin/mcp', { method: 'PUT', body: JSON.stringify({ url: $('mcpUrl').value.trim() }) });
      $('mcpUrl').value = data.url;
      renderTools(data.tools);
      status($('mcpStatus'), data.tools.length + ' tools connected and shared with all workspaces.');
    } catch (error) { status($('mcpStatus'), error.message, true); }
    finally { button.disabled = false; }
  });
  $('disconnectMcp').addEventListener('click', async () => {
    try {
      await api('/api/admin/mcp', { method: 'PUT', body: JSON.stringify({ url: '' }) });
      $('mcpUrl').value = ''; renderTools([]); status($('mcpStatus'), 'Shared MCP server disconnected.');
    } catch (error) { status($('mcpStatus'), error.message, true); }
  });
  if (secret) refresh();
`;
