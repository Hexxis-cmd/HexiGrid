const providerRoot = document.createElement('section');
providerRoot.id = 'view-providers';
providerRoot.className = 'view';
providerRoot.innerHTML = `<div class="page-intro"><div><div class="eyebrow">AI CONNECTIONS</div><h2>Connect your AI</h2><p>Pick what you already use. HexiGrid checks the connection and finds its current models for you.</p></div></div>
<div class="connection-kind-grid" role="tablist" aria-label="Connection type">
  <button class="connection-kind active" role="tab" aria-selected="true" data-connection-kind="api"><span class="connection-glyph" data-icon="key"></span><strong>API key</strong><small>OpenAI, Anthropic, Google, Hugging Face, or compatible</small></button>
  <button class="connection-kind" role="tab" aria-selected="false" data-connection-kind="local"><span class="connection-glyph" data-icon="server"></span><strong>Local model app</strong><small>Ollama, LM Studio, or compatible</small></button>
  <button class="connection-kind" role="tab" aria-selected="false" data-connection-kind="device"><span class="connection-glyph" data-icon="device"></span><strong>This device</strong><small>Run a small model in this browser</small></button>
  <button class="connection-kind" role="tab" aria-selected="false" data-connection-kind="harness"><span class="connection-glyph" data-icon="terminal"></span><strong>Signed-in computer tool</strong><small>OpenCode, Claude Code, or Codex when detected</small></button>
</div>
<div class="provider-workbench">
  <form id="providerForm" class="panel stack-form"><div class="eyebrow">NEW CONNECTION</div><h3 id="providerFormTitle">Connect with an API key</h3>
    <label>1. Choose your service<select id="providerPreset"><option value="opencodezen">OpenCode Zen · recommended</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option><option value="hf">Hugging Face</option><option value="custom">Another compatible API</option></select></label>
    <label id="providerKeyLabel">2. Paste your API key<input id="providerKey" type="password" autocomplete="off" placeholder="Encrypted on this device; never saved in page settings"></label>
    <p id="providerHint" class="simple-callout"></p>
    <div id="providerHelpLinks" class="integration-help-links" aria-label="Setup help"></div>
    <details class="advanced-settings"><summary>Connection details</summary><div class="stack-form"><label>Name<input id="providerName" required maxlength="80"></label><label>API address<input id="providerAddress" required type="url"></label><label>API format<select id="providerStyle"><option value="openai-chat">OpenAI-compatible chat</option><option value="openai-responses">OpenAI Responses</option><option value="anthropic">Anthropic Messages</option><option value="google-gemini">Google Gemini</option></select></label><label>Manual model IDs <small>Usually leave this blank.</small><textarea id="providerModels" rows="3" placeholder="Use only if this service cannot list its models"></textarea></label><label class="checkbox-control"><input id="providerImages" type="checkbox"> This service can also generate images</label></div></details>
    <button class="primary-button" type="submit">Connect and find models</button><p id="providerFeedback" role="status"></p>
  </form>
  <section id="onDevicePanel" class="panel hidden"><div class="eyebrow">BROWSER-NATIVE AI</div><h3>Run a model on this device</h3><p class="panel-copy">No API key and no cloud request. Your browser downloads the selected model once, keeps it in its own private storage, and runs it with your device GPU. The first download can be large.</p><div id="onDeviceSupport" class="simple-callout">Checking whether this browser can run WebGPU…</div><div class="stack-form"><label>Choose a model<select id="onDeviceModel" disabled><option>Checking supported models…</option></select></label><div id="onDeviceModelInfo" class="model-device-info"></div></div><div class="form-actions"><button class="secondary-button" type="button" data-on-device-refresh>Refresh supported models</button><button class="primary-button" type="button" data-on-device-add disabled>Use this model</button><button class="ghost-button" type="button" data-on-device-clear disabled>Remove download</button></div><p id="onDeviceFeedback" role="status"></p><small class="form-note">This is separate from Ollama and LM Studio. If WebGPU is unavailable, use a local model app or API connection instead.</small></section>
  <section id="harnessPanel" class="panel hidden"><div class="eyebrow">TOOLS ON THIS COMPUTER</div><h3>Choose a tool that is already signed in</h3><p class="panel-copy">HexiGrid only lists tools it can detect. Nothing connects until you choose it.</p><div id="harnessList" class="harness-list"></div><button class="secondary-button" data-harness-scan>Scan again</button><p id="harnessFeedback" role="status"></p></section>
  <section class="panel"><div class="eyebrow">YOUR CONNECTIONS</div><h3>Ready to use</h3><div id="providerList"></div></section>
</div>`;
document.querySelector('.main-content').append(providerRoot);
providerRoot.querySelector('#providerImages')?.closest('label')?.insertAdjacentHTML('afterend', '<label class="checkbox-control"><input id="providerSpeech" type="checkbox"> This service has an OpenAI-compatible text-to-speech endpoint</label><label class="checkbox-control"><input id="providerRealtime" type="checkbox"> This service supports OpenAI-compatible realtime voice calls</label>');

function capabilityLabel(capability) {
  return ({ chat: 'chat', image: 'images', speech: 'speech', realtime: 'realtime voice' })[capability] || capability;
}

const providerNav = document.createElement('button');
providerNav.className = 'nav-item'; providerNav.dataset.view = 'providers';
providerNav.innerHTML = '<span class="nav-icon" data-icon="link"></span>AI connections';
document.querySelector('[data-view="models"]').after(providerNav);

const providerPresets = {
  opencodezen: { name:'OpenCode Zen', address:'https://opencode.ai/zen/v1', style:'openai-responses', key:'2. Paste your OpenCode Zen API key', hint:'Recommended first cloud option. HexiGrid fetches the current Zen model list; OpenCode itself is free, while Zen models can be free, promotional, or metered.', guide:'openCodeZen', official:'https://opencode.ai/docs/zen' },
  openai: { name:'OpenAI', address:'https://api.openai.com/v1', style:'openai-responses', key:'2. Paste your OpenAI API key', hint:'HexiGrid asks OpenAI which models this key can use. No model names are hardcoded.', guide:'openai', official:'https://platform.openai.com/docs/quickstart' },
  anthropic: { name:'Anthropic', address:'https://api.anthropic.com/v1', style:'anthropic', key:'2. Paste your Anthropic API key', hint:'HexiGrid asks Anthropic which models this key can use.', guide:'anthropic', official:'https://platform.claude.com/docs/en/api/overview' },
  google: { name:'Google Gemini', address:'https://generativelanguage.googleapis.com/v1beta', style:'google-gemini', key:'2. Paste your Gemini API key', hint:'This connects Gemini models. Google Drive backup is a separate optional connection.', guide:'gemini', official:'https://ai.google.dev/gemini-api/docs/api-key' },
  hf: { name:'Hugging Face', address:'https://router.huggingface.co/v1', style:'openai-chat', key:'2. Paste your Hugging Face token', hint:'HexiGrid asks the Hugging Face router which models your token can use.', guide:'huggingface', official:'https://huggingface.co/docs/hub/models-inference' },
  ollama: { name:'Ollama', address:'http://127.0.0.1:11434/v1', style:'openai-chat', key:'2. API key (usually leave blank)', hint:'Start Ollama first. HexiGrid finds the models installed in it.', guide:'ollama', official:'https://docs.ollama.com/quickstart' },
  lmstudio: { name:'LM Studio', address:'http://127.0.0.1:1234/v1', style:'openai-chat', key:'2. API key (usually leave blank)', hint:'Start the local server in LM Studio first. HexiGrid finds the models it exposes.', guide:'lmstudio', official:'https://lmstudio.ai/docs/developer/core/server' },
  localcustom: { name:'Local model server', address:'http://127.0.0.1:8080/v1', style:'openai-chat', key:'2. API key (if your server requires one)', hint:'Change the local address under Connection details if needed.', guide:'compatibleLocal' },
  custom: { name:'Compatible API', address:'', style:'openai-chat', key:'2. API key (if required)', hint:'Open Connection details once to enter the service address. Models are found automatically when supported.', guide:'compatibleApi' }
};

const onDeviceCatalog = { capabilities: null, models: [], selected: '' };

function onDeviceBrowserId() {
  const key = 'hexigrid-on-device-browser-id';
  let value = localStorage.getItem(key);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,120}$/.test(String(value || ''))) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    value = `browser-${[...bytes].map((item) => item.toString(16).padStart(2, '0')).join('')}`;
    localStorage.setItem(key, value);
  }
  return value;
}

function renderOnDeviceCatalog() {
  const support = document.querySelector('#onDeviceSupport');
  const select = document.querySelector('#onDeviceModel');
  const add = document.querySelector('[data-on-device-add]');
  const clear = document.querySelector('[data-on-device-clear]');
  const info = document.querySelector('#onDeviceModelInfo');
  if (!support || !select || !add || !clear || !info) return;
  const capabilities = onDeviceCatalog.capabilities;
  support.className = `simple-callout${capabilities?.supported ? '' : ' error-message'}`;
  support.textContent = capabilities?.supported ? `Ready. ${onDeviceCatalog.models.length} model${onDeviceCatalog.models.length === 1 ? '' : 's'} can run in this browser.` : (capabilities?.reason || 'This browser cannot run on-device models yet.');
  select.innerHTML = onDeviceCatalog.models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label)}</option>`).join('') || '<option value="">No supported models found</option>';
  select.disabled = !onDeviceCatalog.models.length;
  if (!onDeviceCatalog.models.some((model) => model.id === onDeviceCatalog.selected)) onDeviceCatalog.selected = onDeviceCatalog.models[0]?.id || '';
  select.value = onDeviceCatalog.selected;
  const model = onDeviceCatalog.models.find((item) => item.id === onDeviceCatalog.selected);
  info.innerHTML = model ? `<strong>${escapeHtml(model.label)}</strong><span>${model.vramRequiredMB ? `About ${model.vramRequiredMB.toLocaleString()} MB graphics memory` : 'Memory requirement not published'} · ${model.lowResource ? 'lower-resource option' : 'larger model'}</span><small>The model files are downloaded to this browser only when you send the first message.</small>` : '';
  add.disabled = !model;
  clear.disabled = !model;
}

async function refreshOnDeviceCatalog() {
  const feedback = document.querySelector('#onDeviceFeedback');
  if (!window.HexiGridOnDevice?.supportedModels) {
    onDeviceCatalog.capabilities = { supported: false, reason: 'The browser inference module did not load. Refresh the page and try again.' };
    onDeviceCatalog.models = [];
    renderOnDeviceCatalog();
    return;
  }
  feedback.textContent = 'Checking this browser…';
  try {
    const result = await window.HexiGridOnDevice.supportedModels();
    onDeviceCatalog.capabilities = result;
    onDeviceCatalog.models = result.models || [];
    renderOnDeviceCatalog();
    feedback.textContent = result.models?.length ? 'Choose a model, then add it to your connections.' : 'No on-device model is available in this browser.';
  } catch (error) {
    onDeviceCatalog.capabilities = { supported: false, reason: error.message };
    onDeviceCatalog.models = [];
    renderOnDeviceCatalog();
    feedback.textContent = error.message;
  }
}

async function addOnDeviceConnection() {
  const model = onDeviceCatalog.models.find((item) => item.id === document.querySelector('#onDeviceModel').value);
  const feedback = document.querySelector('#onDeviceFeedback');
  if (!model) return notify('Choose an on-device model first.', true);
  const button = document.querySelector('[data-on-device-add]');
  button.disabled = true;
  feedback.textContent = 'Adding the browser model…';
  try {
    await api('/api/on-device/providers', { method: 'POST', body: JSON.stringify({ name: `This browser · ${model.label}`, deviceId: onDeviceBrowserId(), models: [model] }) });
    await refresh();
    feedback.textContent = `${model.label} is ready. The first message will download its files.`;
    notify('On-device model added.');
  } catch (error) { feedback.textContent = error.message; }
  finally { renderOnDeviceCatalog(); }
}

async function clearOnDeviceDownload() {
  const model = onDeviceCatalog.models.find((item) => item.id === document.querySelector('#onDeviceModel').value);
  if (!model || !window.HexiGridOnDevice?.clearCache) return;
  if (!await userConfirm('Remove this model download?', 'The browser will need to download the model again before it can answer.', 'Remove', true)) return;
  const feedback = document.querySelector('#onDeviceFeedback');
  const button = document.querySelector('[data-on-device-clear]');
  button.disabled = true;
  feedback.textContent = 'Removing the browser model files…';
  try { await window.HexiGridOnDevice.clearCache(model.id); feedback.textContent = 'The browser model download was removed.'; notify('On-device model removed from this browser.'); }
  catch (error) { feedback.textContent = error.message; }
  finally { renderOnDeviceCatalog(); }
}

function setConnectionKind(kind) {
  document.querySelectorAll('[data-connection-kind]').forEach((button) => { const active=button.dataset.connectionKind===kind; button.classList.toggle('active',active); button.setAttribute('aria-selected',String(active)); });
  document.querySelector('#providerForm').classList.toggle('hidden',kind==='harness' || kind==='device');
  document.querySelector('#onDevicePanel').classList.toggle('hidden',kind!=='device');
  document.querySelector('#harnessPanel').classList.toggle('hidden',kind!=='harness');
  const select=document.querySelector('#providerPreset');
  select.innerHTML = kind === 'local'
    ? '<option value="ollama">Ollama</option><option value="lmstudio">LM Studio</option><option value="localcustom">Another local model server</option>'
    : '<option value="opencodezen">OpenCode Zen · recommended</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option><option value="hf">Hugging Face</option><option value="custom">Another compatible API</option>';
  document.querySelector('#providerFormTitle').textContent = kind === 'local' ? 'Connect a local model app' : 'Connect with an API key';
  if (kind !== 'device') applyProviderPreset();
  if (kind === 'device' && typeof refreshOnDeviceCatalog === 'function') refreshOnDeviceCatalog();
  if (kind === 'harness' && typeof scanHarnesses === 'function') scanHarnesses();
}

function applyProviderPreset() {
  const preset = providerPresets[document.querySelector('#providerPreset').value];
  document.querySelector('#providerName').value = preset.name;
  document.querySelector('#providerAddress').value = preset.address;
  document.querySelector('#providerStyle').value = preset.style;
  document.querySelector('#providerKeyLabel').firstChild.textContent = preset.key;
  document.querySelector('#providerHint').textContent = preset.hint;
  document.querySelector('#providerHelpLinks').innerHTML = `<button type="button" class="text-button" data-action="open-guide-topic" data-guide="${preset.guide}">Simple steps</button>${preset.official ? `<a href="${preset.official}" target="_blank" rel="noopener noreferrer">Official guide</a>` : ''}`;
  document.querySelector('.advanced-settings').open = !preset.address || /custom/.test(document.querySelector('#providerPreset').value);
}

function renderProviders() {
  const saved = state.data?.providers || [];
  const harnesses = (state.data?.harnesses || []).filter((item) => item.connected);
  const providers = saved.map((p) => { const browser = p.kind === 'browser-webllm'; const direct = p.kind === 'browser-cloud'; const label = browser ? 'This browser' : direct ? 'Direct from this browser' : p.local ? 'This computer' : 'Cloud API'; const address = browser ? 'Runs locally in this browser' : p.baseUrl; const actions = browser ? `<button class="secondary-button" data-provider-test="${p.id}">Check browser</button>` : `<button class="secondary-button" data-provider-test="${p.id}">Refresh models</button><button class="secondary-button" data-provider-key="${p.id}" ${(isHostBrowser() || direct || isStandaloneBrowser()) ? '' : 'disabled'}>Change key</button>`; return `<article class="saved-provider"><header><strong>${escapeHtml(p.name)}</strong><span class="tag">${label}</span></header><p>${escapeHtml(address)}</p><small>${p.modelIds.length} model${p.modelIds.length===1?'':'s'} · ${(p.capabilities || ['chat']).map(capabilityLabel).join(' + ')} · ${browser ? 'No key needed' : p.hasKey ? 'Key protected' : 'No key needed'}</small>${direct ? '<small>Encrypted by this browser passcode; direct HTTPS requests use no desktop host.</small>' : browser ? '<small>Model files stay in this browser’s private storage.</small>' : ''}${p.lastError?`<p class="error-message">${escapeHtml(p.lastError)}</p>`:''}<div class="provider-actions">${actions}<button class="ghost-button" data-provider-remove="${p.id}">Disconnect</button></div><div class="provider-key-editor hidden" data-provider-editor="${p.id}"><label>New API key<input type="password" autocomplete="off" data-provider-key-input="${p.id}"></label><button class="primary-button" data-provider-key-save="${p.id}">Save new key</button></div></article>`; }).join('');
  const tools = harnesses.map((item) => `<article class="saved-provider"><header><strong>${escapeHtml(item.label)}</strong><span class="tag">Computer tool</span></header><small>Detected, signed in, and connected by you</small><div class="provider-actions"><button class="ghost-button" data-harness-disconnect="${item.id}">Disconnect</button></div></article>`).join('');
  document.querySelector('#providerList').innerHTML = providers + tools || '<div class="empty-state"><strong>No AI connected yet</strong><p>Choose API key, local model app, or a detected computer tool above.</p></div>';
  if (typeof renderHarnesses === 'function') renderHarnesses();
}

document.querySelector('#providerPreset').addEventListener('change', applyProviderPreset);
document.querySelector('#onDeviceModel').addEventListener('change', (event) => { onDeviceCatalog.selected = event.target.value; renderOnDeviceCatalog(); });
document.addEventListener('click',(event)=>{const button=event.target.closest('[data-connection-kind]');if(button)setConnectionKind(button.dataset.connectionKind);});
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-on-device-refresh],[data-on-device-add],[data-on-device-clear]');
  if (!button) return;
  if (button.dataset.onDeviceRefresh !== undefined) refreshOnDeviceCatalog();
  if (button.dataset.onDeviceAdd !== undefined) addOnDeviceConnection();
  if (button.dataset.onDeviceClear !== undefined) clearOnDeviceDownload();
});
setConnectionKind('api');

async function switchToStandaloneBrowser() {
  const status = await window.HexiGridBrowserVault.status();
  if (!status.configured) {
    const answer = await window.hexigridModal({
      title: 'Protect this browser',
      message: 'This phone or browser will work independently. Your passcode makes the encryption key for local agents, chats, and provider keys. There is no recovery backdoor.',
      accept: 'Create browser vault',
      fields: [
        { label: 'New browser passcode (10+ characters)', type: 'password', required: true },
        { label: 'Type it again', type: 'password', required: true }
      ]
    });
    if (!answer) return false;
    if (answer[0] !== answer[1]) throw new Error('The two browser passcodes do not match.');
    await window.HexiGridStandalone.request('/api/auth/setup', { method: 'POST', body: JSON.stringify({ password: answer[0] }) });
  } else if (!status.unlocked) {
    const answer = await window.hexigridModal({ title: 'Unlock this browser', message: 'Enter the passcode that protects this browser’s local HexiGrid data.', accept: 'Unlock', fields: [{ label: 'Browser passcode', type: 'password', required: true }] });
    if (!answer) return false;
    await window.HexiGridStandalone.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password: answer[0] }) });
  } else window.HexiGridStandalone.activate();
  await refresh();
  return true;
}

document.querySelector('#providerForm').addEventListener('submit',async(event)=>{
  event.preventDefault();
  const button=event.submitter; button.disabled=true; const feedback=document.querySelector('#providerFeedback'); feedback.textContent='Checking the connection and finding models…';
  try {
    if (!isHostBrowser() && !isStandaloneBrowser() && !(await switchToStandaloneBrowser())) return;
    const result=await api('/api/providers',{method:'POST',body:JSON.stringify({name:document.querySelector('#providerName').value,baseUrl:document.querySelector('#providerAddress').value,apiStyle:document.querySelector('#providerStyle').value,models:document.querySelector('#providerModels').value,capabilities:['chat',...(document.querySelector('#providerImages').checked?['image']:[]),...(document.querySelector('#providerSpeech')?.checked?['speech']:[]),...(document.querySelector('#providerRealtime')?.checked?['realtime']:[])],apiKey:document.querySelector('#providerKey').value})});
    document.querySelector('#providerKey').value=''; document.querySelector('#providerModels').value=''; await refresh(); feedback.textContent=`Connected ${result.directBrowser ? 'directly from this browser' : 'through the local HexiGrid service'}. Found ${result.provider.modelIds.length} model${result.provider.modelIds.length===1?'':'s'}.`;
  } catch(error){feedback.textContent=error.message;} finally {button.disabled=false;}
});

document.addEventListener('click',async(event)=>{
  const button=event.target.closest('[data-provider-test],[data-provider-remove],[data-provider-key],[data-provider-key-save]'); if(!button)return;
  const id=button.dataset.providerTest||button.dataset.providerRemove||button.dataset.providerKey||button.dataset.providerKeySave;
  if(button.dataset.providerKey){document.querySelector(`[data-provider-editor="${id}"]`)?.classList.toggle('hidden');return;}
  button.disabled=true;
  try {
    if(button.dataset.providerTest){const result=await api(`/api/providers/${id}/test`,{method:'POST'});notify(result.message);await refresh();}
    else if(button.dataset.providerRemove){if(!await userConfirm('Disconnect this service?','Its protected API key will be removed from this device.','Disconnect',true))return;await api(`/api/providers/${id}`,{method:'DELETE'});await refresh();}
    else {const field=document.querySelector(`[data-provider-key-input="${id}"]`);if(!field.value)return notify('Paste the new key first.',true);await api(`/api/providers/${id}/key`,{method:'PUT',body:JSON.stringify({apiKey:field.value})});field.value='';await refresh();notify('Protected API key updated.');}
  }catch(error){notify(error.message,true);}finally{button.disabled=false;}
});
