(() => {
  let currentAudio = null;
  let objectUrl = '';

  const speechProviders = () => (state.data?.providers || []).filter((provider) => provider.enabled && provider.capabilities?.includes('speech'));
  const selectedProvider = () => speechProviders().find((provider) => provider.id === document.querySelector('#generatedVoiceProvider')?.value) || speechProviders()[0] || null;
  const voices = () => String(document.querySelector('#generatedVoiceIds')?.value || 'alloy,nova,shimmer').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 3);

  function stop() {
    currentAudio?.pause();
    currentAudio = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }

  async function requestClip(text, voiceOverride = '') {
    const provider = selectedProvider();
    if (!provider) throw new Error('Connect a speech-capable provider first, or use the free device voices above.');
    const model = document.querySelector('#generatedVoiceModel')?.value || '';
    const voice = voiceOverride || document.querySelector('#generatedVoiceIds')?.value.split(',')[0]?.trim() || '';
    const payload = { providerId: provider.id, model, voice, text };
    try { return await api('/api/live/speech', { method: 'POST', body: JSON.stringify(payload) }); }
    catch (error) {
      if (!error.body?.approvalRequired) throw error;
      const approved = await userConfirm('Generate this voice clip?', 'This sends the supplied text to your selected speech provider. The provider may charge according to your account.', 'Generate voice');
      if (!approved) throw new Error('Voice generation was cancelled.');
      return api('/api/live/speech', { method: 'POST', body: JSON.stringify({ ...payload, approved: true }) });
    }
  }

  async function playResult(result) {
    stop();
    if (result.media?.audioBlob) objectUrl = URL.createObjectURL(result.media.audioBlob);
    const source = result.media?.url || objectUrl;
    if (!source) throw new Error('The speech provider returned no playable audio.');
    currentAudio = new Audio(source);
    currentAudio.onended = () => { currentAudio = null; if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ''; } window.HexiGridLiveCall?.setStatus('Ready'); };
    currentAudio.onerror = () => window.HexiGridLiveCall?.setStatus('The generated voice clip could not be played.', true);
    await currentAudio.play();
  }

  async function preview(index) {
    const options = voices();
    const voice = options[index] || options[0];
    if (!voice) return window.HexiGridLiveCall?.setStatus('Enter one to three provider voice names or IDs.', true);
    document.querySelector('#generatedVoiceChosen').value = voice;
    window.HexiGridLiveCall?.setStatus(`Generating preview ${index + 1}…`);
    try { await playResult(await requestClip(`Hi. This is voice option ${index + 1} for ${window.HexiGridLiveCall?.selectedAgent?.()?.name || 'your agent'}.`, voice)); }
    catch (error) { window.HexiGridLiveCall?.setStatus(error.message, true); }
  }

  async function save() {
    const agent = window.HexiGridLiveCall?.selectedAgent?.();
    const provider = selectedProvider();
    const voiceId = document.querySelector('#generatedVoiceChosen')?.value.trim();
    const model = document.querySelector('#generatedVoiceModel')?.value || '';
    if (!agent || !provider || !model || !voiceId) return notify('Choose an agent, provider, model, and previewed voice first.', true);
    if (!document.querySelector('#generatedVoiceConsent')?.checked) return notify('Confirm that you own this voice or have the speaker’s permission.', true);
    try {
      const response = await api(`/api/agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify({ voiceProfile: { engine: 'provider', providerId: provider.id, model, voiceId, voiceName: '', rate: 1, pitch: 1, volume: 1 } }) });
      Object.assign(agent, response.agent); notify('Generated voice saved to this agent. Future spoken replies use this provider.'); render();
    } catch (error) { notify(error.message, true); }
  }

  async function useDeviceVoice() {
    const agent = window.HexiGridLiveCall?.selectedAgent?.(); if (!agent) return;
    try { const response = await api(`/api/agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify({ voiceProfile: { ...agent.voiceProfile, engine: 'browser', providerId: '', model: '', voiceId: '' } }) }); Object.assign(agent, response.agent); notify('This agent now uses the free device voice.'); render(); }
    catch (error) { notify(error.message, true); }
  }

  function renderModels() {
    const provider = selectedProvider();
    const model = document.querySelector('#generatedVoiceModel'); if (!model) return;
    const preferred = window.HexiGridLiveCall?.selectedAgent?.()?.voiceProfile?.model;
    model.innerHTML = (provider?.modelIds || []).map((id) => `<option value="${escapeHtml(id)}" ${id === preferred ? 'selected' : ''}>${escapeHtml(id)}</option>`).join('') || '<option value="">No models reported</option>';
  }

  function render() {
    const root = document.querySelector('#generatedVoiceLab'); if (!root) return;
    const agent = window.HexiGridLiveCall?.selectedAgent?.();
    const providers = speechProviders();
    const select = document.querySelector('#generatedVoiceProvider');
    const prior = agent?.voiceProfile?.providerId || select?.value;
    select.innerHTML = providers.map((provider) => `<option value="${escapeHtml(provider.id)}" ${provider.id === prior ? 'selected' : ''}>${escapeHtml(provider.name)}</option>`).join('') || '<option value="">No speech provider connected</option>';
    document.querySelector('#generatedVoiceChosen').value = agent?.voiceProfile?.voiceId || '';
    root.classList.toggle('is-unavailable', !providers.length);
    renderModels();
  }

  function mount() {
    const panel = document.querySelector('.live-voice-panel');
    if (!panel || document.querySelector('#generatedVoiceLab')) return;
    panel.insertAdjacentHTML('beforeend', `<div id="generatedVoiceLab" class="generated-voice-lab"><div class="generated-voice-head"><div><div class="eyebrow">OPTIONAL GENERATED VOICE</div><h4>Use a speech provider</h4></div><span class="status-badge">MAY COST MONEY</span></div><p class="panel-copy">The free device voices above work offline. Use this only when you connected an OpenAI-compatible speech service. If that service gave you a custom or consent-based cloned voice ID, enter it here—HexiGrid never clones someone without their permission.</p><div class="generated-voice-grid"><label>Speech provider<select id="generatedVoiceProvider"></select></label><label>Speech model<select id="generatedVoiceModel"></select></label><label>Three voice names or IDs<input id="generatedVoiceIds" value="alloy,nova,shimmer" maxlength="620"></label><label>Chosen voice<input id="generatedVoiceChosen" readonly placeholder="Preview an option"></label></div><label class="checkbox-control generated-voice-consent"><input id="generatedVoiceConsent" type="checkbox"> I own this voice or have the speaker’s permission to use it</label><div class="live-voice-actions"><button class="secondary-button" type="button" data-generated-voice="preview" data-index="0">Generate preview 1</button><button class="secondary-button" type="button" data-generated-voice="preview" data-index="1">Generate preview 2</button><button class="secondary-button" type="button" data-generated-voice="preview" data-index="2">Generate preview 3</button><button class="primary-button" type="button" data-generated-voice="save">Use chosen voice</button><button class="ghost-button" type="button" data-generated-voice="device">Use free device voice</button></div></div>`);
    render();
  }

  async function speakText(text, agent) {
    if (agent?.voiceProfile?.engine !== 'provider') return false;
    const providerSelect = document.querySelector('#generatedVoiceProvider'); if (providerSelect) providerSelect.value = agent.voiceProfile.providerId;
    renderModels();
    const modelSelect = document.querySelector('#generatedVoiceModel'); if (modelSelect) modelSelect.value = agent.voiceProfile.model;
    try { await playResult(await requestClip(text, agent.voiceProfile.voiceId)); }
    catch (error) { window.HexiGridLiveCall?.setStatus(`${error.message} The full reply remains in text.`, true); }
    return true;
  }

  document.addEventListener('click', (event) => { const button = event.target.closest('[data-generated-voice]'); if (!button) return; if (button.dataset.generatedVoice === 'preview') preview(Number(button.dataset.index)); if (button.dataset.generatedVoice === 'save') save(); if (button.dataset.generatedVoice === 'device') useDeviceVoice(); });
  document.addEventListener('change', (event) => { if (event.target.id === 'generatedVoiceProvider') renderModels(); });
  window.addEventListener('hexigrid:rendered', () => { mount(); render(); });
  window.addEventListener('beforeunload', stop);
  window.HexiGridGeneratedVoice = Object.freeze({ mount, render, speakText, stop });
  setTimeout(mount, 0);
})();
