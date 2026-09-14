const integrationSection = document.createElement('section');
integrationSection.id = 'view-integrations';
integrationSection.className = 'view';
integrationSection.innerHTML = `
  <div class="page-intro integration-intro"><div><div class="eyebrow">CONNECTION MATRIX</div><h2>Accounts, tools & media</h2><p>Connect real services, review what they can do, and keep every credential in the protected vault.</p></div><span class="status-badge">LOCAL ORCHESTRATION</span></div>
  <div class="integration-deck">
    <section class="panel integration-module runner-module">
      <header class="module-header"><div class="module-index">01</div><div><div class="eyebrow">ILANDS RUNNER</div><h3>Agent account bridge</h3></div><span id="runnerInstallState" class="status-badge warn">CHECKING</span></header>
      <p class="panel-copy">Each connection signs into one iLands account through its official browser approval page. HexiGrid never sees the account password.</p>
      <form id="runnerProfileForm" class="inline-setup-form">
        <label>Connection name<input id="runnerLabel" maxlength="100" placeholder="My iLands account" required></label>
        <label>Agent harness<select id="runnerHarness"></select></label>
        <button class="primary-button" type="submit">Add connection</button>
      </form>
      <div class="module-actions"><button class="secondary-button" id="runnerInstall" type="button">Install official Runner</button></div><div class="integration-help-links"><button class="text-button" data-action="open-guide-topic" data-guide="ilands">Simple steps</button><a href="https://ilands.ai/agent.md" target="_blank" rel="noopener noreferrer">Official Runner guide</a></div>
      <p id="runnerFeedback" role="status" class="form-feedback"></p>
      <div id="runnerProfiles" class="connection-stack"></div>
    </section>

    <section class="panel integration-module mcp-module">
      <header class="module-header"><div class="module-index">02</div><div><div class="eyebrow">MCP TOOLS</div><h3>Connect a tool server</h3></div><span class="status-badge">SCOPED</span></header>
      <p class="panel-copy">MCP servers can add calendars, files, browsers, robots, databases, and other tools. New servers start disabled.</p>
      <div class="integration-help-links"><button class="text-button" data-action="open-guide-topic" data-guide="tools">Simple steps</button><a href="https://modelcontextprotocol.io/docs/getting-started/intro" target="_blank" rel="noopener noreferrer">Official MCP guide</a><a href="https://podman.io/docs/installation" target="_blank" rel="noopener noreferrer">Podman setup</a></div>
      <form id="mcpForm" class="stack-form compact-form">
        <div class="form-grid two-col"><label>Name<input id="mcpName" maxlength="100" placeholder="My tools" required></label><label>Connection type<select id="mcpTransport"><option value="stdio">Program on this computer</option><option value="http">Secure web server</option></select></label></div>
        <div id="mcpStdioFields"><label>Digest-pinned container image<input id="mcpImage" placeholder="registry.example/tools@sha256:…"></label><label>Command inside container (optional)<input id="mcpCommand" placeholder="server"></label><label>Options, one per line<textarea id="mcpArgs" rows="3" placeholder="--option&#10;value"></textarea></label><label>Workspace access<select id="mcpWorkspaceAccess"><option value="none">No files</option><option value="read">Read workspace</option><option value="write">Read and write workspace</option></select></label><p class="microcopy">Local tool servers run only in rootless Podman with no network and a read-only container. If Podman or the exact image is unavailable, HexiGrid refuses to start it.</p></div>
        <div id="mcpHttpFields" class="hidden"><label>Server address<input id="mcpUrl" type="url" placeholder="https://tools.example.com/mcp"></label></div>
        <div class="form-grid two-col"><label>Secret name (optional)<input id="mcpSecretName" placeholder="API_TOKEN"></label><label>Secret value<input id="mcpSecretValue" type="password" autocomplete="off" placeholder="Stored in OS vault"></label></div>
        <button class="primary-button" type="submit">Add disabled server</button><p id="mcpFeedback" role="status"></p>
      </form>
      <div id="mcpServers" class="connection-stack"></div>
    </section>

    <section class="panel integration-module media-module">
      <header class="module-header"><div class="module-index">03</div><div><div class="eyebrow">LOCAL MEDIA LAB</div><h3>Generate images</h3></div><span class="status-badge">NO ILANDS TOKENS</span></header>
      <p class="panel-copy">Use an image-capable local or cloud provider. Generated files stay in the encrypted local workspace unless you export them.</p>
      <form id="imageForm" class="stack-form compact-form"><div class="form-grid two-col"><label>Provider<select id="imageProvider"></select></label><label>Image model<select id="imageModel"></select></label></div><label>Description<textarea id="imagePrompt" rows="5" maxlength="12000" placeholder="Describe the image clearly…" required></textarea></label><label>Size<select id="imageSize"><option>1024x1024</option><option>1536x1024</option><option>1024x1536</option><option>512x512</option></select></label><button class="primary-button" type="submit">Generate image</button><p id="imageFeedback" role="status"></p></form>
      <div id="mediaGallery" class="media-gallery"></div>
    </section>
  </div>`;
document.querySelector('.main-content').append(integrationSection);
protectHostOnlyControls(document.querySelector('#mcpForm'), 'Add MCP servers and their secrets on the computer running HexiGrid. Remote devices can use already-reviewed tools within policy.');
if (!isHostBrowser()) {
  const installButton = document.querySelector('#runnerInstall');
  installButton.disabled = true;
  installButton.setAttribute('aria-disabled', 'true');
  installButton.title = 'Install Runner on the host computer';
}

const integrationNav = document.createElement('button');
integrationNav.className = 'nav-item';
integrationNav.dataset.view = 'integrations';
integrationNav.innerHTML = '<span class="nav-icon" data-icon="tools"></span>Connections & tools';
(document.querySelector('[data-view="providers"]') || document.querySelector('[data-view="models"]')).after(integrationNav);

const modalRoot = document.createElement('div');
modalRoot.id = 'hexigridModal';
modalRoot.className = 'hexigrid-modal hidden';
modalRoot.innerHTML = '<div class="modal-surface" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-signal"></div><div class="eyebrow" id="modalKicker">CONFIRM</div><h2 id="modalTitle"></h2><p id="modalMessage"></p><div id="modalFields" class="modal-fields"></div><div class="modal-actions"><button class="ghost-button" id="modalCancel" type="button">Cancel</button><button class="primary-button" id="modalAccept" type="button">Continue</button></div></div>';
document.body.append(modalRoot);

const memoryPanel = document.createElement('section');
memoryPanel.id = 'agentMemoryPanel'; memoryPanel.className = 'agent-memory-panel hidden';
memoryPanel.innerHTML = '<div class="memory-heading"><div><div class="eyebrow">OWNER-MANAGED MEMORY</div><h3>What this agent should remember</h3></div><span class="status-badge">ENCRYPTED LOCAL</span></div><p class="panel-copy">These notes supplement the agent’s own identity; they do not overwrite iLands memory.</p><div class="memory-entry"><input id="memoryCategory" maxlength="60" placeholder="Category, e.g. Preferences"><select id="memoryImportance"><option value="3">Normal importance</option><option value="5">High importance</option><option value="1">Low importance</option></select><textarea id="memoryContent" rows="3" maxlength="4000" placeholder="A fact, preference, relationship, or ongoing context…"></textarea><button class="secondary-button" id="addMemory" type="button">Add memory</button></div><div id="agentMemories" class="memory-list"></div>';
document.querySelector('#agentForm .modal-foot').before(memoryPanel);

function modalRequest({ title, message = '', accept = 'Continue', danger = false, fields = [] }) {
  return new Promise((resolve) => {
    const root = document.querySelector('#hexigridModal');
    document.querySelector('#modalTitle').textContent = title;
    document.querySelector('#modalMessage').textContent = message;
    const fieldRoot = document.querySelector('#modalFields');
    fieldRoot.innerHTML = fields.map((field, index) => {
      const help = field.description ? `<small>${escapeHtml(field.description)}</small>` : '';
      if (Array.isArray(field.options)) return `<label>${escapeHtml(field.label)}<select data-modal-field="${index}">${field.options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}</select>${help}</label>`;
      if (field.type === 'checkbox') return `<label class="checkbox-control"><input data-modal-field="${index}" type="checkbox"> ${escapeHtml(field.label)}${help}</label>`;
      return `<label>${escapeHtml(field.label)}<${field.multiline ? 'textarea' : 'input'} data-modal-field="${index}" ${field.multiline ? 'rows="5"' : `type="${field.type || 'text'}"`} placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>${field.multiline ? escapeHtml(field.value || '') : ''}</${field.multiline ? 'textarea' : 'input'}>${help}</label>`;
    }).join('');
    fields.forEach((field, index) => { const input = fieldRoot.querySelector(`[data-modal-field="${index}"]`); if (field.type === 'checkbox') input.checked = field.value === true; else if (!field.multiline) input.value = field.value ?? ''; });
    const acceptButton = document.querySelector('#modalAccept'); acceptButton.textContent = accept; acceptButton.classList.toggle('danger-button', danger);
    root.classList.remove('hidden'); document.body.classList.add('overlay-open');
    const close = (value) => { root.classList.add('hidden'); document.body.classList.remove('overlay-open'); acceptButton.onclick = null; document.querySelector('#modalCancel').onclick = null; resolve(value); };
    document.querySelector('#modalCancel').onclick = () => close(null);
    acceptButton.onclick = () => {
      const values = fields.map((field, index) => { const control = fieldRoot.querySelector(`[data-modal-field="${index}"]`); return field.type === 'checkbox' ? control.checked : control.value; });
      if (fields.some((field, index) => field.required && String(values[index]).trim() === '')) return;
      close(values);
    };
    fieldRoot.querySelector('input,textarea,select')?.focus();
  });
}
window.hexigridModal = modalRequest;

async function copyPlainText(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) { await navigator.clipboard.writeText(value); return true; }
  const field = document.createElement('textarea'); field.value = value; field.readOnly = true; field.setAttribute('aria-hidden', 'true'); field.className = 'clipboard-fallback'; document.body.append(field); field.select();
  try { return document.execCommand('copy'); } finally { field.remove(); }
}

const recoveryButton = document.createElement('button');
recoveryButton.id = 'authRecover'; recoveryButton.type = 'button'; recoveryButton.className = 'text-button full-button'; recoveryButton.textContent = 'Use a recovery code';
document.querySelector('#authSwitch').after(recoveryButton);

let sessionRecords = [];
async function loadSessions() {
  try { sessionRecords = (await api('/api/auth/sessions')).sessions || []; renderSessionSecurity(); } catch { sessionRecords = []; }
}

function renderSessionSecurity() {
  const root = document.querySelector('#securityTools'); if (!root) return;
  let section = root.querySelector('#sessionManager');
  if (!section) { section = document.createElement('div'); section.id = 'sessionManager'; section.className = 'session-manager'; root.append(section); }
  section.innerHTML = `<div class="eyebrow">SIGNED-IN DEVICES</div>${sessionRecords.map((session) => `<div class="session-row"><div><strong>${escapeHtml(session.current ? 'This device' : 'Signed-in device')}</strong><small>${escapeHtml(session.device)} · seen ${escapeHtml(timeAgo(session.lastSeenAt))}</small></div><button class="ghost-button" data-session-revoke="${session.id}">${session.current ? 'Lock' : 'Revoke'}</button></div>`).join('') || '<p class="panel-copy">No active sessions.</p>'}`;
}

function renderAgentMemories() {
  const panel = document.querySelector('#agentMemoryPanel'); const agentId = state.editingAgentId;
  panel.classList.toggle('hidden', !agentId); if (!agentId) return;
  const memories = (state.data?.memories || []).filter((memory) => memory.agentId === agentId);
  document.querySelector('#agentMemories').innerHTML = memories.map((memory) => `<article><div><strong>${escapeHtml(memory.category)}</strong><span>priority ${memory.importance}</span></div><p>${escapeHtml(memory.content)}</p><button class="ghost-button" type="button" data-memory-remove="${memory.id}">Remove</button></article>`).join('') || '<p class="panel-copy">No extra memories. Add only context worth carrying into future local conversations.</p>';
}

async function approvedRequest(url, options, approvalText) {
  try { return await api(url, options); }
  catch (error) {
    if (!error.body?.approvalRequired) throw error;
    const accepted = await modalRequest({ title: 'Approval required', message: approvalText || error.message, accept: 'Approve once', danger: true });
    if (!accepted) throw new Error('Action cancelled.');
    const body = JSON.parse(options.body || '{}');
    return api(url, { ...options, body: JSON.stringify({ ...body, approved: true }) });
  }
}

let runnerPoll;
function renderRunnerProfiles() {
  const profiles = state.data?.runnerProfiles || [];
  const root = document.querySelector('#runnerProfiles');
  document.querySelector('#runnerInstallState').textContent = state.data?.bridge.runnerInstalled ? 'RUNNER FOUND' : 'NOT INSTALLED';
  document.querySelector('#runnerInstallState').classList.toggle('warn', !state.data?.bridge.runnerInstalled);
  document.querySelector('#runnerHarness').innerHTML = (state.data?.bridge.supportedRunnerHarnesses || ['codex', 'claude-code']).map((harness) => `<option value="${escapeHtml(harness)}">${escapeHtml(harness.replaceAll('-', ' '))}</option>`).join('');
  root.innerHTML = profiles.map((profile) => {
    const job = profile.job; const auth = job?.events?.find((event) => event.event === 'runner_authorization_required' && event.verificationUrlComplete);
    const runtime = profile.runtime?.running; const connected = Boolean(profile.agentId);
    return `<article class="runner-profile" data-runner-card="${profile.id}"><div class="connection-line"><span class="connection-pulse ${runtime ? 'online' : ''}"></span><div><strong>${escapeHtml(profile.label)}</strong><small>${escapeHtml(profile.harness)} · ${connected ? 'account linked' : job?.state === 'running' ? 'waiting for setup' : 'not linked'}</small></div><span class="status-badge ${connected ? '' : 'warn'}">${connected ? 'LINKED' : (job?.state || 'NEW').toUpperCase()}</span></div>${auth ? `<a class="authorization-link" href="${escapeHtml(auth.verificationUrlComplete)}" target="_blank" rel="noreferrer">Open iLands approval page <span>↗</span></a><p class="microcopy">Approval expires ${escapeHtml(new Date(auth.expiresAt).toLocaleString())}.</p>` : ''}${job?.error ? `<p class="error-copy">${escapeHtml(job.error)}</p>` : ''}<div class="provider-actions"><button class="secondary-button" data-runner-action="prepare" data-runner-id="${profile.id}">Check harness</button><button class="primary-button" data-runner-action="bind" data-runner-id="${profile.id}" ${job?.state === 'running' ? 'disabled' : ''}>Connect account</button>${connected ? `<button class="secondary-button" data-runner-action="${runtime ? 'stop' : 'start'}" data-runner-id="${profile.id}">${runtime ? 'Stop' : 'Start'}</button>` : ''}<button class="ghost-button" data-runner-action="remove" data-runner-id="${profile.id}">Remove</button></div></article>`;
  }).join('') || '<div class="empty-state"><strong>No iLands accounts linked</strong><p>Add a named connection above. Your agent appears automatically after browser approval.</p></div>';
  clearInterval(runnerPoll);
  if (profiles.some((profile) => profile.job?.state === 'running')) runnerPoll = setInterval(async () => {
    try { for (const profile of profiles.filter((item) => item.job?.state === 'running')) await api(`/api/ilands/jobs/${profile.id}`); await refresh(); } catch { /* next poll can retry */ }
  }, 2500);
}

function renderMcpServers() {
  const root = document.querySelector('#mcpServers');
  const servers = state.data?.mcpServers || [];
  root.innerHTML = servers.map((server) => `<article class="mcp-server"><div class="connection-line"><span class="connection-pulse ${server.enabled ? 'online' : ''}"></span><div><strong>${escapeHtml(server.name)}</strong><small>${server.transport === 'http' ? 'secure web server' : 'rootless Podman container'} · ${server.tools.length} tools</small></div><span class="status-badge ${server.enabled ? '' : 'warn'}">${server.enabled ? 'ENABLED' : 'DISABLED'}</span></div>${server.transport === 'stdio' ? `<p class="microcopy">Pinned image: ${escapeHtml(server.image)} · workspace: ${escapeHtml(server.workspaceAccess || 'none')}</p>` : ''}${server.lastError ? `<p class="error-copy">${escapeHtml(server.lastError)}</p>` : ''}<div class="tool-chip-grid">${server.tools.map((tool) => `<button class="tool-chip" data-mcp-use="${server.id}" data-mcp-tool="${escapeHtml(tool.name)}" ${server.enabled ? '' : 'disabled'}><strong>${escapeHtml(tool.name)}</strong><small>${escapeHtml(tool.description || 'No description provided')}</small></button>`).join('')}</div><div class="provider-actions"><button class="secondary-button" data-mcp-action="test" data-mcp-id="${server.id}">Check & discover tools</button><button class="secondary-button" data-mcp-action="toggle" data-mcp-id="${server.id}" data-mcp-enabled="${!server.enabled}" ${!server.tools.length ? 'disabled' : ''}>${server.enabled ? 'Disable' : 'Enable'}</button><button class="ghost-button" data-mcp-action="remove" data-mcp-id="${server.id}">Remove</button></div></article>`).join('') || '<div class="empty-state"><strong>No MCP tool servers</strong><p>Add one above; HexiGrid will discover its real tools before it can be enabled.</p></div>';
}

function renderMediaLab() {
  const providers = (state.data?.providers || []).filter((provider) => provider.capabilities?.includes('image'));
  const providerSelect = document.querySelector('#imageProvider');
  const current = providerSelect.value;
  providerSelect.innerHTML = providers.map((provider) => `<option value="${provider.id}">${escapeHtml(provider.name)}</option>`).join('') || '<option value="">Add an image provider first</option>';
  if (providers.some((provider) => provider.id === current)) providerSelect.value = current;
  const chosen = providers.find((provider) => provider.id === providerSelect.value) || providers[0];
  document.querySelector('#imageModel').innerHTML = (chosen?.modelIds || []).map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join('');
  document.querySelector('#mediaGallery').innerHTML = (state.data?.media || []).slice(0, 12).map((item) => `<figure><img src="${item.url}" alt="${escapeHtml(item.prompt)}" loading="lazy"><figcaption><strong>${escapeHtml(item.model)}</strong><span>${escapeHtml(new Date(item.createdAt).toLocaleString())}</span></figcaption></figure>`).join('') || '<div class="empty-state">Generated images will appear here.</div>';
}

function renderIntegrations() { renderRunnerProfiles(); renderMcpServers(); renderMediaLab(); void loadSessions(); }
const renderAllBeforeIntegrations = renderAll;
renderAll = function(options) { renderAllBeforeIntegrations(options); renderIntegrations(); };
const openAgentModalBeforeMemories = openAgentModal;
openAgentModal = function(agentId) { openAgentModalBeforeMemories(agentId); renderAgentMemories(); };

document.querySelector('#mcpTransport').addEventListener('change', (event) => {
  document.querySelector('#mcpStdioFields').classList.toggle('hidden', event.target.value !== 'stdio');
  document.querySelector('#mcpHttpFields').classList.toggle('hidden', event.target.value !== 'http');
});
document.querySelector('#imageProvider').addEventListener('change', renderMediaLab);
document.querySelector('#addMemory').addEventListener('click', async () => {
  if (!state.editingAgentId) return;
  const content = document.querySelector('#memoryContent').value.trim(); if (!content) return;
  try { await api(`/api/agents/${state.editingAgentId}/memories`, { method: 'POST', body: JSON.stringify({ category: document.querySelector('#memoryCategory').value, importance: Number(document.querySelector('#memoryImportance').value), content }) }); document.querySelector('#memoryContent').value = ''; await refresh(); renderAgentMemories(); }
  catch (error) { notify(error.message, true); }
});

document.querySelector('#runnerProfileForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const feedback = document.querySelector('#runnerFeedback'); feedback.textContent = 'Creating isolated connection…';
  try { await api('/api/ilands/profiles', { method: 'POST', body: JSON.stringify({ label: document.querySelector('#runnerLabel').value, harness: document.querySelector('#runnerHarness').value }) }); document.querySelector('#runnerLabel').value = ''; await refresh(); feedback.textContent = 'Connection created. Check the harness, then connect the account.'; }
  catch (error) { feedback.textContent = error.message; }
});

document.querySelector('#runnerInstall').addEventListener('click', async () => {
  if (!isHostBrowser()) return notify('Prepare Runner setup on the computer running HexiGrid.', true);
  const feedback = document.querySelector('#runnerFeedback'); const harness = document.querySelector('#runnerHarness').value; feedback.textContent = 'Verifying the live iLands guide and this computer…';
  try {
    if (!['setup', 'goal', 'build'].includes(state.data?.settings?.workMode)) {
      const switchMode = await modalRequest({ title: 'Switch to Connect mode?', message: 'Checking the official setup guide needs network-read permission. Connect mode allows that check while keeping unrelated actions gated.', accept: 'Switch & continue' });
      if (!switchMode) { feedback.textContent = 'Setup cancelled. Nothing changed.'; return; }
      await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ workMode: 'setup' }) });
      await refresh();
    }
    const reviewed = await approvedRequest('/api/ilands/install/plan', { method: 'POST', body: JSON.stringify({ harness }) }, 'Allow HexiGrid to read the official iLands setup guide and verify the release for this computer?');
    const plan = reviewed.plan;
    const accepted = await modalRequest({ title: 'Verified iLands setup handoff', message: `Official release: ${plan.release}\nPlatform: ${plan.platformKey}\nHarness: ${plan.harness}\nGuide fingerprint: ${plan.guideDigest}\n\nHexiGrid will not download or execute an installer. The next step creates a one-time instruction for the official interactive iLands flow.`, accept: 'Create handoff', danger: true });
    if (!accepted) { feedback.textContent = 'Setup handoff cancelled. Nothing was installed.'; return; }
    const result = await approvedRequest('/api/ilands/install', { method: 'POST', body: JSON.stringify({ planId: plan.id, guideDigest: plan.guideDigest, harness: plan.harness }) }, 'Create the reviewed iLands setup handoff? Installation still requires the official interactive approval flow.');
    const copy = await modalRequest({ title: 'Continue in your local agent', message: `${result.message}\n\n${result.instruction}`, accept: 'Copy instruction' });
    if (copy) { const copied = await copyPlainText(result.instruction); feedback.textContent = copied ? 'Setup instruction copied. Paste it into the selected local agent.' : 'Copy was blocked by this browser. Select the instruction in the dialog and copy it manually.'; }
    else feedback.textContent = 'The verified setup handoff is ready. Run it when you are ready to connect this account.';
  } catch (error) { feedback.textContent = error.message; }
});

document.querySelector('#authRecover').addEventListener('click', async () => {
  const answer = await modalRequest({ title: 'Recover this workspace', message: 'Recovery works only on the host computer. It revokes every earlier signed-in session.', accept: 'Reset passcode', danger: true, fields: [{ label: 'Recovery code', required: true }, { label: 'New passcode (10+ characters)', type: 'password', required: true }] });
  if (!answer) return;
  try { const result = await api('/api/auth/recover', { method: 'POST', body: JSON.stringify({ recoveryCode: answer[0], password: answer[1] }) }); await modalRequest({ title: 'Passcode reset', message: `Save the replacement recovery code:\n\n${result.recoveryCode}`, accept: 'I saved it' }); document.querySelector('#authGate').classList.add('hidden'); document.body.classList.remove('overlay-open'); await refresh(); }
  catch (error) { document.querySelector('#authFeedback').textContent = error.message; }
});

document.querySelector('#mcpForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isHostBrowser()) return notify('Add MCP servers on the computer running HexiGrid.', true);
  const transport = document.querySelector('#mcpTransport').value; const secretName = document.querySelector('#mcpSecretName').value.trim();
  const request = { name: document.querySelector('#mcpName').value, transport, image: document.querySelector('#mcpImage').value, command: document.querySelector('#mcpCommand').value, args: document.querySelector('#mcpArgs').value, workspaceAccess: document.querySelector('#mcpWorkspaceAccess').value, url: document.querySelector('#mcpUrl').value, secrets: secretName ? { [transport === 'http' ? 'bearer' : secretName]: document.querySelector('#mcpSecretValue').value } : {} };
  try { await approvedRequest('/api/mcp', { method: 'POST', body: JSON.stringify(request) }, 'Starting a new MCP program can run software on this computer. Add it disabled?'); event.target.reset(); document.querySelector('#mcpFeedback').textContent = 'Server added disabled. Check it to discover real tools.'; await refresh(); }
  catch (error) { document.querySelector('#mcpFeedback').textContent = error.message; }
});

document.querySelector('#imageForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const feedback = document.querySelector('#imageFeedback'); feedback.textContent = 'Generating…';
  const request = { providerId: document.querySelector('#imageProvider').value, model: document.querySelector('#imageModel').value, prompt: document.querySelector('#imagePrompt').value, size: document.querySelector('#imageSize').value };
  try { await approvedRequest('/api/media/images', { method: 'POST', body: JSON.stringify(request) }, 'Approve this image generation once?'); document.querySelector('#imagePrompt').value = ''; feedback.textContent = 'Image saved locally.'; await refresh(); }
  catch (error) { feedback.textContent = error.message; }
});

document.addEventListener('click', async (event) => {
  const memoryButton = event.target.closest('[data-memory-remove]');
  if (memoryButton) { const accepted = await modalRequest({ title: 'Remove this memory?', message: 'The note stops being included in future local agent conversations.', accept: 'Remove memory', danger: true }); if (!accepted) return; try { await api(`/api/memories/${memoryButton.dataset.memoryRemove}`, { method: 'DELETE' }); await refresh(); renderAgentMemories(); } catch (error) { notify(error.message, true); } return; }
  const sessionButton = event.target.closest('[data-session-revoke]');
  if (sessionButton) { const accepted = await modalRequest({ title: 'Revoke this session?', message: 'That browser will need the local passcode before it can access HexiGrid again.', accept: 'Revoke session', danger: true }); if (!accepted) return; try { await api(`/api/auth/sessions/${sessionButton.dataset.sessionRevoke}`, { method: 'DELETE' }); if (sessionRecords.find((item) => item.id === sessionButton.dataset.sessionRevoke)?.current) location.reload(); else await loadSessions(); } catch (error) { notify(error.message, true); } return; }
  const runnerButton = event.target.closest('[data-runner-action]');
  if (runnerButton) {
    const action = runnerButton.dataset.runnerAction; const profileId = runnerButton.dataset.runnerId;
    try {
      if (action === 'remove') { const accepted = await modalRequest({ title: 'Remove this connection?', message: 'Dashboard metadata is removed. Runner credentials are preserved so accidental removal is recoverable.', accept: 'Remove connection', danger: true }); if (!accepted) return; await approvedRequest(`/api/ilands/profiles/${profileId}`, { method: 'DELETE', body: '{}' }, 'Approve removing this connection metadata?'); }
      else await approvedRequest(`/api/ilands/profiles/${profileId}/${action}`, { method: 'POST', body: '{}' }, action === 'bind' ? 'This opens iLands browser authorization for the selected account.' : `Approve ${action} for this Runner?`);
      await refresh();
    } catch (error) { document.querySelector('#runnerFeedback').textContent = error.message; }
    return;
  }
  const mcpButton = event.target.closest('[data-mcp-action]');
  if (mcpButton) {
    const id = mcpButton.dataset.mcpId; const action = mcpButton.dataset.mcpAction;
    try {
      if (action === 'test') await approvedRequest(`/api/mcp/${id}/test`, { method: 'POST', body: '{}' }, 'Start this server briefly and discover the tools it reports?');
      if (action === 'toggle') {
        const enabled = mcpButton.dataset.mcpEnabled === 'true'; const server = state.data.mcpServers.find((item) => item.id === id); let toolGrants = {};
        if (enabled) {
          const fields = server.tools.flatMap((tool) => { const grant = server.toolGrants?.[tool.name] || { capability: 'run_tools', risk: 'high' }; return [
            { label: `${tool.name}: capability`, options: ['read_local', 'network_read', 'write_workspace', 'run_tools', 'external_write', 'generate_media'], value: grant.capability, description: tool.description || 'No description provided.' },
            { label: `${tool.name}: risk`, options: ['low', 'medium', 'high', 'critical'], value: grant.risk },
            { label: `I reviewed ${tool.name}`, type: 'checkbox', value: false }
          ]; });
          const answer = await modalRequest({ title: 'Review every MCP tool', message: `The server identity and ${server.tools.length} tool manifest${server.tools.length === 1 ? '' : 's'} are pinned. Assign only what each tool truly needs. A changed executable, server identity, schema, or tool list will disable the connection.`, accept: 'Enable reviewed tools', danger: true, fields });
          if (!answer) return;
          server.tools.forEach((tool, index) => { toolGrants[tool.name] = { capability: answer[index * 3], risk: answer[index * 3 + 1], approved: answer[index * 3 + 2] === true }; });
        }
        await approvedRequest(`/api/mcp/${id}/enable`, { method: 'PATCH', body: JSON.stringify({ enabled, toolGrants }) }, enabled ? 'Enable these exact reviewed MCP capabilities?' : 'Disable this MCP server?');
      }
      if (action === 'remove') { const accepted = await modalRequest({ title: 'Remove this MCP server?', message: 'Its configuration and protected credential will be deleted from this device.', accept: 'Remove server', danger: true }); if (!accepted) return; await approvedRequest(`/api/mcp/${id}`, { method: 'DELETE', body: '{}' }, 'Approve removal once?'); }
      await refresh();
    } catch (error) { notify(error.message, true); }
    return;
  }
  const toolButton = event.target.closest('[data-mcp-use]');
  if (toolButton) {
    const server = state.data.mcpServers.find((item) => item.id === toolButton.dataset.mcpUse); const tool = server?.tools.find((item) => item.name === toolButton.dataset.mcpTool); if (!tool) return;
    const properties = tool.inputSchema?.properties || {}; const required = new Set(tool.inputSchema?.required || []);
    const fields = Object.entries(properties).slice(0, 30).map(([name, schema]) => ({ label: schema.title || name, placeholder: schema.description || '', required: required.has(name), multiline: schema.type === 'object' || schema.type === 'array', value: schema.default === undefined ? '' : typeof schema.default === 'string' ? schema.default : JSON.stringify(schema.default) }));
    const values = await modalRequest({ title: tool.name, message: tool.description || `Run a tool from ${server.name}.`, accept: 'Review & run', fields }); if (!values) return;
    const input = {}; Object.keys(properties).slice(0, 30).forEach((name, index) => { const schema = properties[name]; const value = values[index]; if (!value && !required.has(name)) return; if (schema.type === 'number' || schema.type === 'integer') input[name] = Number(value); else if (schema.type === 'boolean') input[name] = /^(true|yes|1)$/i.test(value); else if (schema.type === 'object' || schema.type === 'array') { try { input[name] = JSON.parse(value); } catch { throw new Error(`${name} needs valid structured data.`); } } else input[name] = value; });
    try { const result = await approvedRequest(`/api/mcp/${server.id}/call`, { method: 'POST', body: JSON.stringify({ tool: tool.name, input }) }, `Run ${tool.name} through ${server.name}?`); const output = JSON.stringify(result.result, null, 2).slice(0, 12000); await modalRequest({ title: `${tool.name} completed`, message: output, accept: 'Done' }); await refresh(); } catch (error) { notify(error.message, true); }
  }
});
