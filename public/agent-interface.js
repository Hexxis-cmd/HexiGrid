(() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
  const records = (items, render) => `<div class="records">${items.length ? items.map(render).join('') : '<p>No records.</p>'}</div>`;

  async function request(path, options = {}) {
    if (window.HexiGridStandalone?.isActive()) return window.HexiGridStandalone.request(path, options);
    try {
      const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json', ...(options.headers || {}) } });
      const type = response.headers.get('content-type') || '';
      if ((response.status === 404 || response.status === 405) && !type.includes('application/json')) { window.HexiGridStandalone.activate(); return window.HexiGridStandalone.request(path, options); }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.error || `Request failed (${response.status}).`), { status: response.status, body });
      return body;
    } catch (error) {
      if (error.status) throw error;
      window.HexiGridStandalone.activate();
      return window.HexiGridStandalone.request(path, options);
    }
  }

  function render(manifest, state) {
    document.querySelector('#agentUnlock').hidden = true;
    document.querySelector('#agentStatus').innerHTML = `<h2>Status</h2><p>Interface <code>${escape(manifest.schemaVersion)}</code> · app <code>${escape(manifest.appVersion)}</code> · ${state.security?.standaloneBrowser ? 'standalone browser vault' : 'authenticated local service'}</p>`;
    document.querySelector('#agentRules').innerHTML = manifest.operatingRules.map((rule) => `<li>${escape(rule)}</li>`).join('');
    document.querySelector('#agentPolicy').innerHTML = `<div><dt>Work mode</dt><dd><code>${escape(state.settings.workMode)}</code></dd></div><div><dt>Approval profile</dt><dd><code>${escape(state.settings.approvalPolicy)}</code></dd></div><div><dt>Default model</dt><dd><code>${escape(state.settings.model || 'not-configured')}</code></dd></div><div><dt>Secret values exposed</dt><dd>No</dd></div>`;
    document.querySelector('#agentProviders').innerHTML = records(state.providers || [], (provider) => `<article class="record" data-provider-id="${escape(provider.id)}"><strong>${escape(provider.name)}</strong><small>${escape(provider.kind || (provider.local ? 'local' : 'cloud'))} · ${provider.modelIds?.length || 0} models · key ${provider.hasKey ? 'configured' : 'not required'}</small></article>`);
    document.querySelector('#agentRoster').innerHTML = records(state.agents || [], (agent) => `<article class="record" data-agent-id="${escape(agent.id)}"><strong>${escape(agent.name)}</strong><small>model <code>${escape(agent.model || 'not-configured')}</code> · ${escape(agent.status)}</small></article>`);
    document.querySelector('#agentRooms').innerHTML = records(state.rooms || [], (room) => `<article class="record" data-room-id="${escape(room.id)}"><strong>${escape(room.name)}</strong><small>${room.agentIds?.length || 0} participants · ${room.messages?.length || 0} messages</small></article>`);
    document.querySelector('#agentReceipts').innerHTML = records((state.receipts || []).slice(0, 20), (receipt) => `<article class="record" data-receipt-id="${escape(receipt.id)}"><strong>${escape(receipt.status)} · ${escape(receipt.action)}</strong><small>${escape(receipt.detail)}</small></article>`);
    document.querySelector('#agentActions').innerHTML = records(Object.entries(manifest.actions), ([name, action]) => `<article class="record" data-action-name="${escape(name)}"><strong>${escape(action.method)} <code>${escape(action.path)}</code></strong><small>${escape(name)}${action.required ? ` · required: ${escape(action.required.join(', '))}` : ''}</small></article>`);
  }

  async function start() {
    try {
      const [manifest, state] = await Promise.all([request('/api/agent-interface'), request('/api/bootstrap')]);
      render(manifest, state);
    } catch (error) {
      const root = document.querySelector('#agentStatus');
      root.classList.add('error');
      root.innerHTML = `<h2>Locked</h2><p>${escape(error.status === 401 ? 'Unlock this tab to read the safe agent control surface.' : error.message)}</p>`;
      document.querySelector('#agentUnlock').hidden = error.status !== 401;
    }
  }

  document.querySelector('#agentUnlockForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = document.querySelector('#agentUnlockFeedback');
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    feedback.textContent = 'Unlocking locally…';
    try {
      await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: document.querySelector('#agentPasscode').value }) });
      document.querySelector('#agentPasscode').value = '';
      document.querySelector('#agentStatus').classList.remove('error');
      await start();
      feedback.textContent = '';
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });

  start();
})();
