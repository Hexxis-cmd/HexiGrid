(() => {
  const vault = () => window.HexiGridBrowserVault;
  const providerApi = () => window.HexiGridBrowserProviders;
  let active = false;
  let previousState = null;

  const workModes = [
    ['converse', 'Converse', 'Talk, reflect, and use attached context without taking tool actions.', ['conversation']],
    ['setup', 'Connect', 'Set up accounts, models, plugins, and devices. Agent work remains paused.', ['conversation', 'network_read']],
    ['plan', 'Plan', 'Inspect allowed information and produce a plan. No writes, execution, delegation, or external changes.', ['conversation', 'network_read']],
    ['goal', 'Goal', 'Pursue a named outcome persistently within available browser capabilities.', ['conversation', 'network_read']],
    ['sketch', 'Sketch', 'Create drafts and previews without changing connected services.', ['conversation', 'generate_media']],
    ['research', 'Research', 'Gather and compare information and preserve citations.', ['conversation', 'network_read']],
    ['build', 'Build', 'Use capabilities available safely in this browser.', ['conversation', 'network_read']],
    ['watch', 'Watch', 'Monitor while this browser remains open.', ['conversation', 'network_read']]
  ].map(([id, label, description, capabilities]) => ({ id, label, description, capabilities }));
  const approvalProfiles = [
    { id: 'ask', label: 'Ask for approval', shortLabel: 'Always ask', description: 'Pause before every action outside conversation.' },
    { id: 'review', label: 'Approve for me', shortLabel: 'Risk reviewed', description: 'Proceed with routine work and ask before sensitive or difficult-to-reverse actions.' },
    { id: 'full', label: 'Full access', shortLabel: 'No prompts', description: 'Proceed without per-action prompts inside existing browser scopes.' }
  ];

  const now = () => new Date().toISOString();
  const id = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  const bodyOf = (options) => options?.body ? JSON.parse(options.body) : {};
  const clean = (value, fallback = '') => String(value ?? '').trim() || fallback;
  const communicationDefaults = () => ({
    enabled: true,
    instructions: 'Write like a real person having a clear conversation. Prefer the shortest complete answer. Use ordinary words, vary sentence length, avoid repeated reassurance, and do not stack several adjectives where one will do.',
    examples: [
      { situation: 'A yes or no question', avoid: 'A long technical summary followed by repeated reassurance.', prefer: 'Answer yes or no first, then add one useful sentence if needed.' },
      { situation: 'The owner sounds casual', avoid: 'Formal report language and canned phrases.', prefer: 'Match the casual tone while staying clear and honest.' }
    ]
  });

  function initialState() {
    return {
      version: 1,
      settings: {
        brand: 'HexiGrid', model: '', modelPolicy: 'all-models', approvalPolicy: 'review', workMode: 'converse',
        activeGoal: { title: '', status: 'idle', createdAt: null }, subagents: { enabled: false, maxConcurrent: 1, inheritPolicy: true },
        communicationGuide: communicationDefaults(), owner: { displayName: 'Owner', avatarImage: '' },
        sync: { enabled: false, provider: 'google-drive', status: 'unavailable_in_standalone_browser', encrypted: true, configured: false, lastSyncAt: null },
        auth: { configured: true, provider: 'browser-passcode' }, plugins: { grants: {} }, autoStart: false, setupAcknowledged: false
      },
      agents: [], rooms: [], activity: [], usage: [], providers: [], receipts: [], memories: [], tasks: [], taskRuns: [],
      plugins: [], pluginPublishers: [], mcpServers: [], media: [], runnerProfiles: [], harnessConnections: [], liveTranscripts: []
    };
  }

  function failure(status, message, extra = {}) {
    const error = new Error(message);
    error.status = status;
    error.body = { error: message, ...extra };
    throw error;
  }

  function requireUnlocked() {
    try { return vault().read(); } catch (error) { failure(401, error.message, { authRequired: true }); }
  }

  function publicProvider(provider) {
    const { secret, ...safe } = provider;
    return { ...safe, hasKey: Boolean(secret) };
  }

  function routeForModel(state, modelId) {
    const match = String(modelId || '').match(/^provider:([^:]+):(.+)$/);
    if (!match) return null;
    const provider = state.providers.find((item) => item.id === match[1]);
    return provider ? { provider, model: match[2] } : null;
  }

  function addReceipt(state, values) {
    const receipt = { id: id('receipt'), agentId: null, risk: 'low', status: 'completed', source: 'browser', createdAt: now(), ...values };
    state.receipts.unshift(receipt);
    state.receipts = state.receipts.slice(0, 500);
    return receipt;
  }

  function addActivity(state, kind, text) {
    state.activity.unshift({ id: id('event'), kind, text, createdAt: now() });
    state.activity = state.activity.slice(0, 500);
  }

  async function save(state) { await vault().write(state); }

  function publicState(state) {
    return {
      settings: { ...structuredClone(state.settings), auth: { configured: true, provider: 'browser-passcode' } },
      agents: structuredClone(state.agents), rooms: structuredClone(state.rooms), activity: structuredClone(state.activity), usage: structuredClone(state.usage),
      bridge: { runnerInstalled: false, model: state.settings.model, port: null, supportedRunnerHarnesses: [], standaloneBrowser: true, modelCatalogError: '' },
      policyCatalog: { workModes, approvalProfiles, riskLevels: ['none', 'low', 'medium', 'high', 'critical'] }, modelCatalog: [], harnesses: [], harnessConnections: [],
      providers: state.providers.map(publicProvider), plugins: [], pluginPublishers: [], tasks: [], taskRuns: [], runnerProfiles: [], receipts: structuredClone(state.receipts),
      mcpServers: [], media: [], memories: structuredClone(state.memories), liveTranscripts: structuredClone(state.liveTranscripts || []), backupRecovery: { localRollbackAvailable: Boolean(previousState) }, communicationDefaults: communicationDefaults(),
      security: { credentialVaultAvailable: true, localStateEncryption: 'browser-passcode-aes-256-gcm', secretFeaturesAvailable: true, standaloneBrowser: true, notice: 'Provider keys and local data are encrypted in this browser with your passcode. The usable key exists only while this page is unlocked.' },
      guide: { steps: ['Create or unlock this browser vault.', 'Connect a direct cloud API or an on-device model.', 'Create an agent and assign a discovered model.', 'Send a test message and review its local receipt.'] }
    };
  }

  async function completeAgent(state, agent, room, imageDataUrl = '') {
    const route = routeForModel(state, agent.model);
    if (!route) throw new Error('Assign this agent a connected cloud model first.');
    const messages = window.HexiGridBrowserChat?.browserAgentMessages
      ? window.HexiGridBrowserChat.browserAgentMessages({ agent, room, settings: state.settings, memories: state.memories })
      : [{ role: 'system', content: `You are ${agent.name}. ${agent.instructions || ''}` }, ...room.messages.slice(-18).map((message) => ({ role: message.role === 'user' ? 'user' : 'assistant', content: message.content }))];
    if (imageDataUrl) {
      const lastUser = [...messages].reverse().find((message) => message.role === 'user');
      if (!lastUser) throw new Error('A frame needs a user message.');
      lastUser.content = [{ type: 'text', text: `${lastUser.content}\n\nThe owner deliberately attached one current camera or screen frame. Describe only what is visible and do not infer hidden details.` }, { type: 'image_url', image_url: { url: imageDataUrl } }];
    }
    return providerApi().complete(route.provider, route.provider.secret, route.model, messages);
  }

  async function handleProviders(pathname, method, options, state) {
    if (pathname === '/api/providers' && method === 'POST') {
      const body = bodyOf(options);
      const config = { name: clean(body.name, 'Cloud provider').slice(0, 80), baseUrl: providerApi().cleanUrl(body.baseUrl), apiStyle: clean(body.apiStyle, 'openai-chat'), local: false };
      const secret = String(body.apiKey || '').slice(0, 4000);
      let records = [];
      if (clean(body.models)) records = clean(body.models).split(/[\n,]/).map((model) => ({ id: model.trim(), label: model.trim(), pricing: null })).filter((model) => model.id).slice(0, 300);
      else records = (await providerApi().discover(config, secret)).models;
      const provider = { ...config, id: id('provider'), kind: 'browser-cloud', enabled: true, capabilities: Array.isArray(body.capabilities) ? body.capabilities.filter((item) => ['chat', 'image', 'speech'].includes(item)) : ['chat'], secret, modelIds: records.map((item) => item.id), modelMeta: records, createdAt: now(), lastCheckedAt: now(), lastError: '' };
      state.providers.push(provider);
      if (!state.settings.model) state.settings.model = `provider:${provider.id}:${provider.modelIds[0]}`;
      addReceipt(state, { action: `provider:${provider.id}:connect`, capability: 'network_read', risk: 'medium', detail: `${provider.name} connected directly from this browser and reported ${provider.modelIds.length} models.` });
      addActivity(state, 'connection', `${provider.name} connected directly from this browser.`);
      await save(state);
      return { provider: publicProvider(provider), directBrowser: true };
    }
    const match = pathname.match(/^\/api\/providers\/([a-zA-Z0-9-]+)(?:\/(test|key))?$/);
    if (!match) return null;
    const provider = state.providers.find((item) => item.id === match[1]);
    if (!provider) failure(404, 'Provider not found.');
    if (method === 'DELETE' && !match[2]) {
      const prefix = `provider:${provider.id}:`;
      if (state.settings.model.startsWith(prefix) || state.agents.some((agent) => agent.model?.startsWith(prefix))) failure(409, 'Choose another model for agents and the default before removing this provider.');
      state.providers = state.providers.filter((item) => item.id !== provider.id);
      addReceipt(state, { action: `provider:${provider.id}:disconnect`, capability: 'network_read', risk: 'medium', detail: `${provider.name} and its encrypted browser credential were removed.` });
      await save(state); return { ok: true };
    }
    if (method === 'PUT' && match[2] === 'key') {
      provider.secret = String(bodyOf(options).apiKey || '').slice(0, 4000);
      addReceipt(state, { action: `provider:${provider.id}:credential`, capability: 'network_read', risk: 'high', detail: `${provider.name} browser credential was ${provider.secret ? 'replaced' : 'removed'}.` });
      await save(state); return { provider: publicProvider(provider) };
    }
    if (method === 'POST' && match[2] === 'test') {
      try {
        const result = await providerApi().discover(provider, provider.secret);
        provider.modelIds = result.models.map((item) => item.id); provider.modelMeta = result.models; provider.lastCheckedAt = now(); provider.lastError = '';
        addReceipt(state, { action: `provider:${provider.id}:test`, capability: 'network_read', risk: 'medium', detail: result.message });
        await save(state); return { ok: true, message: `${result.message} No desktop or local runtime was used.`, models: provider.modelIds };
      } catch (error) { provider.lastError = error.message; await save(state); throw error; }
    }
    return null;
  }

  async function request(input, options = {}) {
    active = true;
    const url = new URL(input, location.origin);
    const pathname = url.pathname;
    const method = String(options.method || 'GET').toUpperCase();

    if (pathname === '/api/system/identity') return { product: 'hexigrid', version: '0.0.1', instanceId: 'standalone-browser', scheme: location.protocol.replace(':', ''), developmentFreshStart: false, standaloneBrowser: true };
    if (pathname === '/api/auth/status') { const status = await vault().status(); return { configured: status.configured, authenticated: status.unlocked, provider: 'browser-passcode', googleAvailable: false, standaloneBrowser: true }; }
    if (pathname === '/api/auth/setup' && method === 'POST') {
      const password = String(bodyOf(options).password || '');
      await vault().setup(password, initialState());
      return { ok: true, auth: { configured: true, authenticated: true, provider: 'browser-passcode' }, recoveryNotice: 'There is no recovery backdoor. Keep this passcode safe.' };
    }
    if (pathname === '/api/auth/login' && method === 'POST') { await vault().unlock(String(bodyOf(options).password || '')); return { ok: true, auth: { configured: true, authenticated: true, provider: 'browser-passcode' } }; }
    if (pathname === '/api/auth/logout' && method === 'POST') { vault().lock(); return { ok: true }; }

    const state = requireUnlocked();
    if (pathname === '/api/agent-interface') return {
      product: 'HexiGrid', schemaVersion: '1.0', appVersion: '0.0.1', interface: 'agent-control-surface',
      presentation: { human: '/', agent: '/agent-interface.html', machine: '/api/agent-interface' },
      security: { authenticationRequired: true, csrfRequiredForBrowserMutations: false, secretsAcceptedInChat: false, permissionBypassAvailable: false, rule: 'The agent interface has no access that the human interface does not have.' },
      operatingRules: ['Read the current snapshot before acting.', 'Never request, display, log, or place secrets in a prompt.', 'Tell the human to enter credentials only in the visible AI connections screen.', 'Do not claim success without a successful response and receipt.', 'Do not change policy to bypass a denial.', 'Stop for sign-in, consent, payment, identity selection, permissions, or approval.'],
      resources: { snapshot: { method: 'GET', path: '/api/bootstrap' }, agents: { method: 'GET', path: '/api/agents' }, models: { method: 'GET', path: '/api/models' } },
      actions: { updateSettings: { method: 'PATCH', path: '/api/settings' }, createAgent: { method: 'POST', path: '/api/agents', required: ['name'] }, updateAgent: { method: 'PATCH', path: '/api/agents/{agentId}' }, createRoom: { method: 'POST', path: '/api/rooms', required: ['name'] }, updateRoom: { method: 'PATCH', path: '/api/rooms/{roomId}' }, sendRoomMessage: { method: 'POST', path: '/api/rooms/{roomId}/messages', required: ['content'] }, testProvider: { method: 'POST', path: '/api/providers/{providerId}/test' } },
      platform: { standaloneBrowser: true, unavailableActionsMustReturn: { status: 409, field: 'platformUnavailable' } }
    };
    if (pathname === '/api/bootstrap') return publicState(state);
    if (pathname === '/api/network') return { enabled: false, urls: [], pairingCode: '', standaloneBrowser: true };
    if (pathname === '/api/agents' && method === 'GET') return { agents: structuredClone(state.agents) };
    if (pathname === '/api/rooms' && method === 'GET') return { rooms: structuredClone(state.rooms) };
    if (pathname === '/api/models' && method === 'GET') {
      const models = state.providers.flatMap((provider) => (provider.modelMeta || provider.modelIds.map((modelId) => ({ id: modelId, label: modelId }))).map((model) => ({
        id: `provider:${provider.id}:${model.id}`,
        label: model.label || model.id,
        provider: provider.name,
        providerId: provider.id,
        local: Boolean(provider.local),
        pricing: model.pricing || null
      })));
      return { models, selected: state.settings.model, policy: state.settings.modelPolicy };
    }

    const providerResult = await handleProviders(pathname, method, options, state);
    if (providerResult) return providerResult;

    if (pathname === '/api/on-device/providers' && method === 'POST') {
      const body = bodyOf(options); const models = Array.isArray(body.models) ? body.models : [];
      if (!models.length) failure(400, 'Choose an on-device model.');
      const provider = { id: id('provider'), name: clean(body.name, 'This browser'), kind: 'browser-webllm', deviceId: clean(body.deviceId), baseUrl: '', apiStyle: 'browser-webllm', local: true, enabled: true, capabilities: ['chat'], modelIds: models.map((item) => item.id), modelMeta: models, createdAt: now(), lastError: '' };
      state.providers.push(provider); if (!state.settings.model) state.settings.model = `provider:${provider.id}:${provider.modelIds[0]}`;
      addReceipt(state, { action: `provider:${provider.id}:connect`, capability: 'conversation', detail: `${provider.name} was added without an API key.` }); await save(state);
      return { provider: publicProvider(provider) };
    }

    if (pathname === '/api/settings' && method === 'PATCH') {
      const patch = bodyOf(options);
      state.settings = { ...state.settings, ...patch, owner: { ...state.settings.owner, ...(patch.owner || {}) }, activeGoal: { ...state.settings.activeGoal, ...(patch.activeGoal || {}) }, subagents: { ...state.settings.subagents, ...(patch.subagents || {}) }, communicationGuide: patch.communicationGuide ? { ...state.settings.communicationGuide, ...patch.communicationGuide } : state.settings.communicationGuide };
      await save(state); return { settings: publicState(state).settings };
    }
    if (pathname === '/api/models/refresh' && method === 'POST') {
      const errors = [];
      for (const provider of state.providers.filter((item) => item.kind === 'browser-cloud')) try { const found = await providerApi().discover(provider, provider.secret); provider.modelIds = found.models.map((item) => item.id); provider.modelMeta = found.models; provider.lastError = ''; } catch (error) { provider.lastError = error.message; errors.push(`${provider.name}: ${error.message}`); }
      await save(state);
      const models = state.providers.flatMap((provider) => provider.modelIds.map((modelId) => ({ id: `provider:${provider.id}:${modelId}`, label: provider.modelMeta?.find((item) => item.id === modelId)?.label || modelId, provider: provider.name, providerId: provider.id, local: Boolean(provider.local) })));
      return { models, selected: state.settings.model, policy: state.settings.modelPolicy, error: errors.join(' ') };
    }
    if (pathname === '/api/usage/browser' && method === 'POST') {
      const body = bodyOf(options); state.usage.push({ id: id('usage'), agentId: null, model: body.model, inputTokens: Number(body.inputTokens) || Math.ceil(String(body.inputText || '').length / 4), outputTokens: Number(body.outputTokens) || Math.ceil(String(body.outputText || '').length / 4), estimated: !Number.isFinite(Number(body.inputTokens)), source: 'browser', createdAt: now() }); await save(state); return { ok: true };
    }

    if (pathname === '/api/agents' && method === 'POST') {
      const body = bodyOf(options); const name = clean(body.name, `Agent ${state.agents.length + 1}`);
      const voice = body.voiceProfile && typeof body.voiceProfile === 'object' ? body.voiceProfile : {};
      const agent = { id: id('agent'), name, accountLabel: clean(body.accountLabel, 'Standalone browser'), avatar: clean(body.avatar, name[0]?.toUpperCase() || 'A'), avatarImage: clean(body.avatarImage), color: clean(body.color, '#8d7dff'), status: 'local_ready', transport: 'browser', harness: '', ilandsAgentId: '', runnerHome: '', workspacePath: '', personality: clean(body.personality), instructions: clean(body.instructions), rules: clean(body.rules), model: clean(body.model, state.settings.model), useGlobalCommunication: body.useGlobalCommunication !== false, voiceProfile: { engine: voice.engine === 'provider' ? 'provider' : 'browser', voiceName: clean(voice.voiceName).slice(0, 200), providerId: clean(voice.providerId).slice(0, 120), model: clean(voice.model).slice(0, 240), voiceId: clean(voice.voiceId).slice(0, 200), rate: Math.min(2, Math.max(.5, Number(voice.rate) || 1)), pitch: Math.min(2, Math.max(0, Number(voice.pitch) || 1)), volume: Math.min(1, Math.max(0, Number(voice.volume) || 1)) }, tags: Array.isArray(body.tags) ? body.tags.slice(0, 12) : [], createdAt: now(), updatedAt: now() };
      state.agents.push(agent); addActivity(state, 'agent', `${agent.name} was added to this browser.`); await save(state); return { agent };
    }
    const duplicate = pathname.match(/^\/api\/agents\/([^/]+)\/duplicate$/);
    if (duplicate && method === 'POST') { const source = state.agents.find((item) => item.id === duplicate[1]); if (!source) failure(404, 'Agent not found.'); const agent = { ...source, id: id('agent'), name: `${source.name} copy`, createdAt: now(), updatedAt: now() }; state.agents.push(agent); await save(state); return { agent }; }
    const agentMatch = pathname.match(/^\/api\/agents\/([^/]+)$/);
    if (agentMatch) {
      const agent = state.agents.find((item) => item.id === agentMatch[1]); if (!agent) failure(404, 'Agent not found.');
      if (method === 'PATCH') {
        const patch = bodyOf(options);
        if (patch.voiceProfile && typeof patch.voiceProfile === 'object') {
          const voice = patch.voiceProfile;
          patch.voiceProfile = { engine: voice.engine === 'provider' ? 'provider' : 'browser', voiceName: clean(voice.voiceName).slice(0, 200), providerId: clean(voice.providerId).slice(0, 120), model: clean(voice.model).slice(0, 240), voiceId: clean(voice.voiceId).slice(0, 200), rate: Math.min(2, Math.max(.5, Number(voice.rate) || 1)), pitch: Math.min(2, Math.max(0, Number(voice.pitch) || 1)), volume: Math.min(1, Math.max(0, Number(voice.volume) || 1)) };
        }
        Object.assign(agent, patch, { updatedAt: now() }); await save(state); return { agent };
      }
      if (method === 'DELETE') { state.agents = state.agents.filter((item) => item.id !== agent.id); state.rooms.forEach((room) => { room.agentIds = room.agentIds.filter((item) => item !== agent.id); }); state.memories = state.memories.filter((item) => item.agentId !== agent.id); await save(state); return { ok: true }; }
    }

    if (pathname === '/api/rooms' && method === 'POST') { const body = bodyOf(options); const room = { id: id('room'), name: clean(body.name, 'New room'), description: clean(body.description), agentIds: [], messages: [], createdAt: now() }; state.rooms.push(room); await save(state); return { room }; }
    const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (roomMatch && method === 'PATCH') { const room = state.rooms.find((item) => item.id === roomMatch[1]); if (!room) failure(404, 'Room not found.'); const body = bodyOf(options); if (body.name !== undefined) room.name = clean(body.name, room.name); if (body.description !== undefined) room.description = clean(body.description); if (Array.isArray(body.agentIds)) room.agentIds = body.agentIds.filter((agentId) => state.agents.some((agent) => agent.id === agentId)); await save(state); return { room }; }
    const userMessage = pathname.match(/^\/api\/rooms\/([^/]+)\/messages\/user$/);
    if (userMessage && method === 'POST') { const room = state.rooms.find((item) => item.id === userMessage[1]); if (!room) failure(404, 'Room not found.'); const body = bodyOf(options); const content = clean(body.content); if (!content) failure(400, 'Message is empty.'); room.agentIds = Array.isArray(body.agentIds) ? body.agentIds.filter((agentId) => state.agents.some((agent) => agent.id === agentId)) : room.agentIds; if (!room.agentIds.length) failure(400, 'Select at least one agent first.'); room.messages.push({ id: id('msg'), role: 'user', author: 'You', content, createdAt: now() }); await save(state); return { room }; }
    const browserMessage = pathname.match(/^\/api\/rooms\/([^/]+)\/messages\/browser$/);
    if (browserMessage && method === 'POST') { const room = state.rooms.find((item) => item.id === browserMessage[1]); const body = bodyOf(options); const agent = state.agents.find((item) => item.id === body.agentId); if (!room || !agent) failure(404, 'Room or agent not found.'); const message = body.error ? { id: id('msg'), role: 'system', agentId: agent.id, author: agent.name, content: `On-device model unavailable: ${clean(body.error)}`, createdAt: now() } : { id: id('msg'), role: 'agent', agentId: agent.id, author: agent.name, content: clean(body.content), delivery: 'local-only', createdAt: now() }; room.messages.push(message); if (!body.error) state.usage.push({ id: id('usage'), agentId: agent.id, model: agent.model, inputTokens: Number(body.inputTokens) || 0, outputTokens: Number(body.outputTokens) || 0, source: 'browser-webllm', createdAt: now() }); await save(state); return { room, message }; }
    const messages = pathname.match(/^\/api\/rooms\/([^/]+)\/messages$/);
    if (messages && method === 'POST') {
      const room = state.rooms.find((item) => item.id === messages[1]); if (!room) failure(404, 'Room not found.'); const body = bodyOf(options);
      if (body.includeUserMessage !== false) { const content = clean(body.content); if (!content) failure(400, 'Message is empty.'); room.messages.push({ id: id('msg'), role: 'user', author: 'You', content, createdAt: now() }); }
      const selected = (Array.isArray(body.agentIds) ? body.agentIds : room.agentIds).map((agentId) => state.agents.find((agent) => agent.id === agentId)).filter(Boolean); if (!selected.length) failure(400, 'Select at least one agent first.');
      for (const agent of selected) { const result = await completeAgent(state, agent, room, clean(body.imageDataUrl)); room.messages.push({ id: id('msg'), role: 'agent', agentId: agent.id, author: agent.name, content: result.content, delivery: 'direct-browser', createdAt: now() }); state.usage.push({ id: id('usage'), agentId: agent.id, model: agent.model, inputTokens: Number(result.inputTokens) || 0, outputTokens: Number(result.outputTokens) || 0, source: 'direct-browser', createdAt: now() }); addReceipt(state, { agentId: agent.id, action: `model:${agent.model}`, capability: 'conversation', detail: `${agent.name} replied through a direct browser HTTPS request.` }); }
      await save(state); return { room };
    }
    if (pathname === '/api/assistant' && method === 'POST') { const content = clean(bodyOf(options).content); const route = routeForModel(state, state.settings.model); if (!route) failure(400, 'Choose a connected cloud model first.'); const result = await providerApi().complete(route.provider, route.provider.secret, route.model, [{ role: 'system', content: 'You are the HexiGrid control assistant. Explain setup in plain language. Never claim to use a tool unless a receipt confirms it.' }, { role: 'user', content }]); state.usage.push({ id: id('usage'), model: state.settings.model, inputTokens: Number(result.inputTokens) || 0, outputTokens: Number(result.outputTokens) || 0, source: 'direct-browser', createdAt: now() }); await save(state); return { content: result.content, model: state.settings.model }; }
    if (pathname === '/api/communication/preview' && method === 'POST') { const body = bodyOf(options); return { content: `Got it — ${clean(body.message, 'I’ll keep replies clear, natural, and brief.')}` }; }

    if (pathname === '/api/live/speech' && method === 'POST') {
      const body = bodyOf(options); const provider = state.providers.find((item) => item.id === clean(body.providerId));
      if (!provider || !provider.capabilities?.includes('speech')) failure(400, 'Choose a provider configured for speech generation.');
      if (!provider.modelIds.includes(clean(body.model))) failure(400, 'Choose one of this provider’s configured speech models.');
      const result = await providerApi().speech(provider, provider.secret, { model: body.model, voice: body.voice, text: body.text });
      addReceipt(state, { action: 'generate_speech', capability: 'generate_media', risk: 'medium', detail: `${provider.name} generated a voice clip directly for this browser.` }); await save(state);
      return { media: { type: 'audio', audioBlob: result.audioBlob, mimeType: result.mimeType, model: clean(body.model), voice: clean(body.voice) } };
    }

    if (pathname === '/api/live/transcripts' && method === 'GET') return { transcripts: structuredClone(state.liveTranscripts || []) };
    if (pathname === '/api/live/transcripts' && method === 'POST') {
      const body = bodyOf(options);
      const entries = Array.isArray(body.entries) ? body.entries.slice(-600).map((entry) => ({ role: ['user', 'agent', 'system'].includes(entry?.role) ? entry.role : 'system', agentId: clean(entry?.agentId) || null, speaker: clean(entry?.speaker, entry?.role === 'user' ? 'You' : 'HexiGrid'), text: clean(entry?.text).slice(0, 12000), createdAt: clean(entry?.createdAt, now()) })).filter((entry) => entry.text) : [];
      if (!entries.length) failure(400, 'Save a live conversation before saving its transcript.');
      const transcript = { id: id('transcript'), title: clean(body.title, 'Live session').slice(0, 160), agentId: clean(body.agentId) || null, roomId: clean(body.roomId) || null, entries, createdAt: now(), updatedAt: now() };
      state.liveTranscripts = [transcript, ...(state.liveTranscripts || [])].slice(0, 100); addReceipt(state, { action: `live-transcript:${transcript.id}:save`, capability: 'write_local', detail: 'A live transcript was saved to this browser.' }); await save(state); return { transcript };
    }
    const liveTranscript = pathname.match(/^\/api\/live\/transcripts\/([a-z0-9-]+)$/);
    if (liveTranscript && method === 'DELETE') { const before = state.liveTranscripts?.length || 0; state.liveTranscripts = (state.liveTranscripts || []).filter((item) => item.id !== liveTranscript[1]); if (state.liveTranscripts.length === before) failure(404, 'Transcript not found.'); await save(state); return { ok: true }; }

    if (pathname === '/api/backup/export' && method === 'POST') { const passphrase = String(bodyOf(options).passphrase || ''); const backup = structuredClone(state); backup.providers = backup.providers.map(({ secret, ...provider }) => ({ ...provider, secret: '' })); const envelope = await window.HexiGridBrowserCrypto.encryptWithPassphrase({ format: 'hexigrid-standalone-backup', version: 1, state: backup }, passphrase); return { envelope, filename: `hexigrid-browser-backup-${new Date().toISOString().slice(0, 10)}.json` }; }
    if (pathname === '/api/backup/import' && method === 'POST') { const body = bodyOf(options); const decoded = await window.HexiGridBrowserCrypto.decryptWithPassphrase(body.envelope, String(body.passphrase || '')); if (decoded?.format !== 'hexigrid-standalone-backup' || !decoded.state?.settings || !Array.isArray(decoded.state.agents)) failure(400, 'This backup does not contain valid HexiGrid browser data.'); previousState = state; await vault().replaceFromBackup(decoded.state); return { ok: true, state: publicState(decoded.state) }; }
    if (pathname === '/api/backup/rollback' && method === 'POST') { if (!previousState) failure(409, 'No browser restore is available to roll back.'); const restored = previousState; previousState = state; await vault().replaceFromBackup(restored); return { ok: true, state: publicState(restored) }; }

    const unsupported = pathname.startsWith('/api/workspace') ? 'The browser sandbox cannot open operating-system project folders. Use downloaded/uploaded files or a paired desktop host.'
      : pathname.startsWith('/api/tasks') ? 'Background autonomous tasks cannot be guaranteed after a mobile browser closes. Use a paired always-on host for scheduling.'
      : pathname.startsWith('/api/plugins') || pathname.startsWith('/api/mcp') ? 'Executable plugins and MCP containers require an isolated host. Direct cloud chat and on-device models remain available here.'
      : 'This action needs a HexiGrid host and is unavailable in standalone browser mode.';
    failure(409, unsupported, { platformUnavailable: true, standaloneBrowser: true });
  }

  function shouldFallback(response, body, contentType) {
    if (active) return true;
    return (response.status === 404 || response.status === 405) && !contentType.includes('application/json') && (!body || typeof body === 'string');
  }

  window.HexiGridStandalone = Object.freeze({ request, shouldFallback, isActive: () => active, activate: () => { active = true; } });
})();
