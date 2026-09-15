(() => {
  let localStream = null;
  let screenStream = null;
  let recognition = null;
  let recognitionActive = false;
  let listeningRequested = false;
  let turnController = null;
  let transcript = [];
  let pendingFrame = '';
  let mounted = false;

  const now = () => new Date().toISOString();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const addEntry = (role, text, agentId = null, speaker = role === 'user' ? 'You' : 'HexiGrid') => {
    const clean = String(text || '').trim();
    if (!clean) return;
    transcript.push({ role, text: clean, agentId, speaker, createdAt: now() });
    transcript = transcript.slice(-600);
    renderTranscript();
  };

  function selectedAgent() {
    const id = document.querySelector('#liveAgentSelect')?.value;
    return state.data?.agents?.find((item) => item.id === id) || state.data?.agents?.[0] || null;
  }

  function selectedRoom() {
    const id = document.querySelector('#liveRoomSelect')?.value;
    return state.data?.rooms?.find((item) => item.id === id) || null;
  }

  function setStatus(text, error = false) {
    const status = document.querySelector('#liveStatus');
    if (status) { status.textContent = text; status.classList.toggle('error', error); }
    const hint = document.querySelector('#liveSupportHint');
    if (hint && error) hint.textContent = text;
  }

  function renderSelectors() {
    if (!mounted || !state.data) return;
    const agentSelect = document.querySelector('#liveAgentSelect');
    const roomSelect = document.querySelector('#liveRoomSelect');
    if (!agentSelect || !roomSelect) return;
    const priorAgent = agentSelect.value || selectedAgent()?.id;
    const priorRoom = roomSelect.value || selectedRoom()?.id;
    agentSelect.innerHTML = state.data.agents.length ? state.data.agents.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.accountLabel || 'Local profile')}</option>`).join('') : '<option value="">No agents connected yet</option>';
    roomSelect.innerHTML = state.data.rooms.length ? state.data.rooms.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('') : '<option value="">Create a room when you send</option>';
    if ([...agentSelect.options].some((option) => option.value === priorAgent)) agentSelect.value = priorAgent;
    if ([...roomSelect.options].some((option) => option.value === priorRoom)) roomSelect.value = priorRoom;
    const presence = document.querySelector('#liveAgentPresence');
    if (presence) presence.textContent = selectedAgent()?.name || 'Choose an agent';
    document.querySelector('#liveNoAgent')?.classList.toggle('hidden', Boolean(state.data.agents.length));
    window.HexiGridLiveVoice?.render();
    window.HexiGridGeneratedVoice?.render();
  }

  function renderTranscript() {
    const root = document.querySelector('#liveTranscript');
    if (!root) return;
    root.innerHTML = transcript.map((entry) => `<li class="live-transcript-entry ${escapeHtml(entry.role)}"><div><strong>${escapeHtml(entry.speaker)}</strong><time>${escapeHtml(new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</time></div><p>${escapeHtml(entry.text)}</p></li>`).join('') || '<li class="empty-state">Your live transcript stays in this tab until you choose Save transcript.</li>';
    root.scrollTop = root.scrollHeight;
    const save = document.querySelector('#liveSaveTranscript');
    if (save) save.disabled = transcript.length === 0;
  }

  function renderSavedTranscripts() {
    const root = document.querySelector('#liveSavedTranscripts');
    if (!root) return;
    const records = state.data?.liveTranscripts || [];
    root.innerHTML = records.map((record) => `<article class="live-saved-row"><div><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(new Date(record.createdAt).toLocaleString())} · ${record.entries.length} lines</small></div><button class="ghost-button" type="button" data-live-action="delete-transcript" data-transcript-id="${escapeHtml(record.id)}">Delete</button></article>`).join('') || '<p class="microcopy">No saved transcripts yet. Saving is always a deliberate choice.</p>';
  }

  function setButtons() {
    const hasStream = Boolean(localStream);
    const hasScreen = Boolean(screenStream);
    const mic = document.querySelector('#liveMuteMic'); const camera = document.querySelector('#liveToggleCamera'); const start = document.querySelector('#liveStartMedia'); const share = document.querySelector('#liveShareScreen'); const frame = document.querySelector('#liveCaptureFrame');
    if (start) start.disabled = hasStream;
    if (mic) { mic.disabled = !hasStream; mic.textContent = localStream?.getAudioTracks()?.[0]?.enabled === false ? 'Unmute mic' : 'Mute mic'; }
    if (camera) { camera.disabled = !hasStream; camera.textContent = localStream?.getVideoTracks()?.[0]?.enabled === false ? 'Turn camera on' : 'Turn camera off'; }
    if (share) { share.disabled = !navigator.mediaDevices?.getDisplayMedia; share.textContent = hasScreen ? 'Stop screen preview' : 'Preview screen'; }
    if (frame) frame.disabled = !hasStream && !hasScreen;
    document.querySelector('#liveStopMedia').disabled = !hasStream && !hasScreen;
  }

  async function startMedia() {
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('Camera and microphone are not available in this browser. Text chat still works.', true);
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const video = document.querySelector('#liveLocalVideo');
      video.srcObject = localStream; video.hidden = false; document.querySelector('#liveMediaEmpty').hidden = true;
      setStatus('Camera and mic ready'); setButtons();
    } catch (error) { setStatus(error.name === 'NotAllowedError' ? 'Camera or microphone permission was declined. You can still use text and voice output.' : `Camera and microphone could not start: ${error.message}`, true); }
  }

  async function toggleScreen() {
    if (screenStream) return stopScreen();
    if (!navigator.mediaDevices?.getDisplayMedia) return setStatus('Screen sharing is not supported by this browser.', true);
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.querySelector('#liveScreenVideo'); video.srcObject = screenStream; video.hidden = false;
      screenStream.getVideoTracks()[0].addEventListener('ended', stopScreen, { once: true });
      setStatus('Screen share is on'); setButtons();
    } catch (error) { setStatus(error.name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : `Screen sharing could not start: ${error.message}`, true); }
  }

  function stopScreen() {
    screenStream?.getTracks().forEach((track) => track.stop()); screenStream = null;
    const video = document.querySelector('#liveScreenVideo'); if (video) { video.srcObject = null; video.hidden = true; }
    setStatus(localStream ? 'Camera and mic ready' : 'Ready'); setButtons();
  }

  function stopMedia() {
    window.HexiGridLiveRecording?.stop();
    localStream?.getTracks().forEach((track) => track.stop()); localStream = null; stopScreen();
    const video = document.querySelector('#liveLocalVideo'); if (video) { video.srcObject = null; video.hidden = true; }
    const empty = document.querySelector('#liveMediaEmpty'); if (empty) empty.hidden = false;
    setStatus('Ready'); setButtons();
  }

  function toggleMic() { const track = localStream?.getAudioTracks()?.[0]; if (track) { track.enabled = !track.enabled; setButtons(); setStatus(track.enabled ? 'Mic on' : 'Mic muted'); } }
  function toggleCamera() { const track = localStream?.getVideoTracks()?.[0]; if (track) { track.enabled = !track.enabled; setButtons(); setStatus(track.enabled ? 'Camera on' : 'Camera off'); } }

  function activeMediaStream() {
    const tracks = [];
    const videoTrack = screenStream?.getVideoTracks()?.[0] || localStream?.getVideoTracks()?.[0];
    const audioTrack = localStream?.getAudioTracks()?.[0];
    if (videoTrack) tracks.push(videoTrack);
    if (audioTrack) tracks.push(audioTrack);
    return tracks.length ? new MediaStream(tracks) : null;
  }

  function clearFrame() {
    pendingFrame = '';
    const preview = document.querySelector('#liveFramePreview');
    if (preview) { preview.removeAttribute('src'); preview.hidden = true; }
    const clear = document.querySelector('#liveClearFrame'); if (clear) clear.hidden = true;
    const capture = document.querySelector('#liveCaptureFrame'); if (capture) capture.textContent = 'Attach current frame';
  }

  function frameFromPreview() {
    const video = screenStream ? document.querySelector('#liveScreenVideo') : document.querySelector('#liveLocalVideo');
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return '';
    const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
    let frame = canvas.toDataURL('image/jpeg', .76);
    if (frame.length > 1400 * 1024) frame = canvas.toDataURL('image/jpeg', .55);
    return frame;
  }

  function captureFrame() {
    pendingFrame = frameFromPreview();
    if (!pendingFrame) return setStatus('Wait for the preview to appear, then try again.', true);
    const preview = document.querySelector('#liveFramePreview'); if (preview) { preview.src = pendingFrame; preview.hidden = false; }
    const clear = document.querySelector('#liveClearFrame'); if (clear) clear.hidden = false;
    const capture = document.querySelector('#liveCaptureFrame'); if (capture) capture.textContent = 'Replace attached frame';
    setStatus('One still frame is attached to the next message.');
  }

  async function ensureRoom(agentItem) {
    let room = selectedRoom();
    if (!room) {
      const response = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ name: `Live · ${agentItem.name}`, description: 'A local live session created by HexiGrid.' }) });
      state.data.rooms.push(response.room); room = response.room;
      document.querySelector('#liveRoomSelect').value = room.id;
    }
    if (!room.agentIds.includes(agentItem.id)) {
      const response = await api(`/api/rooms/${room.id}`, { method: 'PATCH', body: JSON.stringify({ agentIds: [...room.agentIds, agentItem.id] }) });
      Object.assign(room, response.room);
    }
    return room;
  }

  async function sendToAgent(content) {
    const agentItem = selectedAgent();
    if (!agentItem) return setStatus('Add an agent first, then start a live session.', true);
    const message = String(content || '').trim(); if (!message) return;
    if (document.querySelector('#liveAutoFrame')?.checked) {
      const freshFrame = frameFromPreview();
      if (freshFrame) pendingFrame = freshFrame;
    }
    if (turnController) turnController.abort();
    turnController = new AbortController();
    addEntry('user', message, null, 'You');
    setStatus(`${agentItem.name} is thinking…`);
    try {
      const room = await ensureRoom(agentItem);
      let response = await api(`/api/rooms/${room.id}/messages/user`, { method: 'POST', body: JSON.stringify({ content: message, agentIds: [agentItem.id] }) });
      Object.assign(room, response.room);
      const model = modelInfo(agentItem.model);
      if (model?.browser) {
        if (pendingFrame) throw new Error('This on-device model connection accepts text only. Choose a vision-capable API model to attach a frame.');
        const generated = await window.HexiGridBrowserChat.completeTurn({ agent: agentItem, room, settings: state.data.settings, memories: state.data.memories, modelId: model.remoteModel, signal: turnController.signal });
        response = await api(`/api/rooms/${room.id}/messages/browser`, { method: 'POST', body: JSON.stringify({ agentId: agentItem.id, content: generated.content, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, inputText: message, outputText: generated.content }) });
      } else {
        response = await api(`/api/rooms/${room.id}/messages`, { method: 'POST', body: JSON.stringify({ agentIds: [agentItem.id], includeUserMessage: false, approved: false, imageDataUrl: pendingFrame }) });
      }
      Object.assign(room, response.room);
      const reply = [...room.messages].reverse().find((item) => item.role === 'agent' && item.agentId === agentItem.id);
      if (reply) { addEntry('agent', reply.content, agentItem.id, agentItem.name); window.HexiGridLiveVoice?.speak(reply.content, agentItem); }
      clearFrame();
      setStatus('Ready');
      if (typeof renderAll === 'function') renderAll({ preserveCommunication: true });
    } catch (error) {
      if (error.name === 'AbortError') return setStatus('Response cancelled. The text already received remains in the transcript.');
      addEntry('system', error.message, agentItem.id, 'HexiGrid'); setStatus(error.message, true);
    } finally { turnController = null; }
  }

  function startListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return setStatus('Live speech recognition is not available in this browser. Use the message box instead.', true);
    if (recognitionActive || listeningRequested) { listeningRequested = false; recognition?.stop(); return; }
    listeningRequested = true;
    recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = navigator.language || 'en-US';
    let finalText = '';
    recognition.onstart = () => { recognitionActive = true; setStatus('Listening…'); document.querySelector('#liveListen').textContent = 'Stop listening'; };
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) { const text = event.results[index][0].transcript; if (event.results[index].isFinal) finalText += ` ${text}`; else interim += text; }
      document.querySelector('#liveInterim').textContent = interim ? `Hearing: ${interim}` : '';
      if (finalText.trim()) {
        const raw = finalText.trim(); finalText = '';
        const wakeEnabled = document.querySelector('#liveWakeWordEnabled')?.checked;
        const wakeWord = document.querySelector('#liveWakeWord')?.value.trim().toLowerCase();
        if (wakeEnabled && wakeWord) {
          const phrase = raw.toLowerCase(); const wakeIndex = phrase.indexOf(wakeWord);
          if (wakeIndex < 0) { document.querySelector('#liveInterim').textContent = `Waiting for “${wakeWord}”…`; return; }
          const message = raw.slice(wakeIndex + wakeWord.length).trim();
          if (message) sendToAgent(message); else document.querySelector('#liveInterim').textContent = 'Wake word heard. What should I send?';
        } else sendToAgent(raw);
      }
    };
    recognition.onerror = (event) => { if (['not-allowed', 'service-not-allowed'].includes(event.error)) listeningRequested = false; setStatus(`Speech recognition stopped: ${event.error || 'browser error'}`, true); };
    recognition.onend = () => {
      recognitionActive = false;
      if (listeningRequested && document.visibilityState === 'visible') {
        setTimeout(() => { try { recognition?.start(); } catch { listeningRequested = false; } }, 250);
        return;
      }
      document.querySelector('#liveListen').textContent = 'Start listening'; if (!turnController) setStatus('Ready');
    };
    recognition.start();
  }

  function stopReply() {
    window.HexiGridLiveVoice?.stop();
    setStatus(turnController ? 'Voice stopped. The agent is still finishing the written reply.' : 'Voice stopped. The full text stays in the transcript.');
  }

  async function saveTranscript() {
    if (!transcript.length) return setStatus('There is no transcript to save yet.', true);
    const agentItem = selectedAgent(); const room = selectedRoom();
    const payload = { title: `Live session · ${agentItem?.name || 'HexiGrid'}`, agentId: agentItem?.id || null, roomId: room?.id || null, entries: transcript };
    try {
      const response = await api('/api/live/transcripts', { method: 'POST', body: JSON.stringify(payload) });
      if (response.transcript) state.data.liveTranscripts = [response.transcript, ...(state.data.liveTranscripts || [])];
      renderSavedTranscripts();
      setStatus('Transcript saved locally.'); notify('Transcript saved locally.');
    } catch (error) {
      const file = new Blob([transcript.map((entry) => `[${new Date(entry.createdAt).toLocaleString()}] ${entry.speaker}: ${entry.text}`).join('\n\n')], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = `hexigrid-live-${new Date().toISOString().slice(0, 10)}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setStatus('The local service was unavailable, so a text copy was downloaded.');
    }
  }

  async function deleteTranscript(transcriptId) {
    try {
      await api(`/api/live/transcripts/${transcriptId}`, { method: 'DELETE' });
      state.data.liveTranscripts = (state.data.liveTranscripts || []).filter((item) => item.id !== transcriptId);
      renderSavedTranscripts(); notify('Saved transcript deleted.');
    } catch (error) { notify(error.message, true); }
  }

  function clearTranscript() { transcript = []; renderTranscript(); setStatus('Transcript cleared from this live session.'); }

  function mount() {
    if (mounted) return;
    const main = document.querySelector('.main-content'); if (!main) return;
    const section = document.createElement('section'); section.id = 'view-live'; section.className = 'view'; section.innerHTML = `
      <div class="page-intro"><div><div class="eyebrow">LIVE COMMUNICATION</div><h2>Talk to one agent</h2><p>Speak naturally, hear replies, and optionally open a private camera preview. Camera and screen video stay on this device; they are not sent to the agent.</p></div><span id="liveStatus" class="status-badge">Ready</span></div>
      <div class="live-layout">
        <section class="panel live-stage"><header class="module-header"><div><div class="eyebrow">PRIVATE PREVIEW</div><h3>Camera and screen</h3></div><span class="status-badge" id="livePrivacyBadge">LOCAL ONLY</span></header><div class="live-video-stage"><div id="liveMediaEmpty" class="live-media-empty"><span class="live-core">◈</span><strong>Camera is off</strong><p>Press Start camera + mic when you are ready. The browser will ask for permission.</p></div><video id="liveLocalVideo" class="live-video" autoplay muted playsinline hidden></video><video id="liveScreenVideo" class="live-screen-video" autoplay muted playsinline hidden></video><div class="live-agent-presence"><span class="presence-wave"><i></i><i></i><i></i></span><strong id="liveAgentPresence">Choose an agent</strong><small>Agent replies appear as text and can be read aloud by this browser.</small></div></div><div class="live-controls"><button class="primary-button" id="liveStartMedia" type="button" data-live-action="start-media">Start camera + mic</button><button class="secondary-button" id="liveMuteMic" type="button" data-live-action="mute" disabled>Mute mic</button><button class="secondary-button" id="liveToggleCamera" type="button" data-live-action="camera" disabled>Turn camera off</button><button class="secondary-button" id="liveShareScreen" type="button" data-live-action="screen">Preview screen</button><button class="ghost-button" id="liveStopMedia" type="button" data-live-action="stop-media" disabled>Stop media</button></div><div id="liveRecordingControls" class="live-recording-controls"></div><p id="liveSupportHint" class="microcopy">The agent cannot see this preview. Nothing records automatically; recording requires a separate click and saves directly to your device.</p></section>
        <section class="panel live-conversation"><header class="module-header"><div><div class="eyebrow">ONE RESPONDER AT A TIME</div><h3>Live conversation</h3></div><span class="status-badge">TEXT + VOICE</span></header><div class="live-selectors"><label>Agent<select id="liveAgentSelect"></select></label><label>Room<select id="liveRoomSelect"></select></label></div><div class="live-wake-controls"><label class="checkbox-control"><input id="liveWakeWordEnabled" type="checkbox"> Wait for a wake phrase</label><label>Wake phrase<input id="liveWakeWord" maxlength="80" placeholder="Optional, e.g. hey grid"></label></div><p id="liveNoAgent" class="empty-state hidden">Add an agent in Agents first. This view will populate automatically.</p><ol id="liveTranscript" class="live-transcript"></ol><p id="liveInterim" class="live-interim" aria-live="polite"></p><form id="liveMessageForm" class="live-composer"><textarea id="liveMessageInput" rows="3" placeholder="Type a message, or start listening…"></textarea><div><button class="primary-button" type="submit">Send to agent</button><button class="secondary-button" id="liveListen" type="button" data-live-action="listen">Start listening</button><button class="ghost-button" id="liveStopReply" type="button" data-live-action="stop-reply">Stop voice</button></div></form><div class="live-record-actions"><button class="secondary-button" id="liveSaveTranscript" type="button" data-live-action="save-transcript" disabled>Save transcript</button><button class="ghost-button" type="button" data-live-action="clear-transcript">Clear this session</button></div><div id="liveSavedTranscripts" class="live-saved-transcripts"></div></section>
      </div>
      <section class="panel live-voice-panel"><header class="module-header"><div><div class="eyebrow">VOICE PREVIEW</div><h3>Choose how this agent sounds</h3></div><span class="status-badge">BROWSER VOICE</span></header><p class="panel-copy">These are voices your device already provides. HexiGrid does not upload recordings or clone a voice. Preview three options, then save the one you like to the selected agent.</p><div class="live-voice-controls"><label>Voice<select id="liveVoiceSelect"></select></label><label>Rate<input id="liveVoiceRate" type="range" min="0.5" max="2" step="0.05" value="1"></label><label>Pitch<input id="liveVoicePitch" type="range" min="0" max="2" step="0.05" value="1"></label><label>Volume<input id="liveVoiceVolume" type="range" min="0.1" max="1" step="0.05" value="0.72"></label></div><div class="live-voice-actions"><button class="secondary-button" type="button" data-live-voice-action="preview" data-preview="0">Preview 1</button><button class="secondary-button" type="button" data-live-voice-action="preview" data-preview="1">Preview 2</button><button class="secondary-button" type="button" data-live-voice-action="preview" data-preview="2">Preview 3</button><button class="primary-button" type="button" data-live-voice-action="save">Save voice</button><button class="ghost-button" type="button" data-live-voice-action="stop">Stop preview</button></div><p id="liveVoiceSupport" class="microcopy">Checking this browser’s speech voices…</p><p id="liveVoiceValue" class="microcopy">1.00× · pitch 1.00</p></section>`;
    section.querySelector('.live-controls')?.insertAdjacentHTML('beforeend', '<button class="secondary-button" id="liveCaptureFrame" type="button" data-live-action="capture-frame" disabled>Attach current frame</button>');
    section.querySelector('#liveRecordingControls')?.insertAdjacentHTML('beforebegin', '<div id="liveFrameAttachment" class="live-frame-attachment"><img id="liveFramePreview" alt="Frame attached to the next agent message" hidden><button class="ghost-button" id="liveClearFrame" type="button" data-live-action="clear-frame" hidden>Remove frame</button></div>');
    section.querySelector('#liveRecordingControls')?.insertAdjacentHTML('beforebegin', '<label class="checkbox-control live-auto-frame"><input id="liveAutoFrame" type="checkbox"> Include one fresh frame with every message</label>');
    const support = section.querySelector('#liveSupportHint');
    if (support) support.textContent = 'Video stays private. The agent sees only a still frame when you press Attach current frame and then send a message with a vision-capable API model.';
    main.append(section);
    const nav = document.createElement('button'); nav.className = 'nav-item'; nav.dataset.view = 'live'; nav.innerHTML = '<span class="nav-icon" data-icon="speech"></span>Live';
    document.querySelector('[data-view="room"]')?.after(nav);
    mounted = true;
    renderSelectors(); renderTranscript(); renderSavedTranscripts(); setButtons();
  }

  function bind() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-live-action]'); if (!button) return;
      const action = button.dataset.liveAction;
      if (action === 'start-media') startMedia();
      if (action === 'mute') toggleMic();
      if (action === 'camera') toggleCamera();
      if (action === 'screen') toggleScreen();
      if (action === 'capture-frame') captureFrame();
      if (action === 'clear-frame') { clearFrame(); setStatus('Attached frame removed.'); }
      if (action === 'stop-media') stopMedia();
      if (action === 'listen') startListening();
      if (action === 'stop-reply') stopReply();
      if (action === 'save-transcript') saveTranscript();
      if (action === 'clear-transcript') clearTranscript();
      if (action === 'delete-transcript') deleteTranscript(button.dataset.transcriptId);
    });
    document.addEventListener('submit', (event) => { if (event.target.id !== 'liveMessageForm') return; event.preventDefault(); const input = document.querySelector('#liveMessageInput'); const value = input.value.trim(); input.value = ''; sendToAgent(value); });
    document.addEventListener('change', (event) => { if (event.target.matches('#liveAgentSelect')) { renderSelectors(); document.querySelector('#liveAgentPresence').textContent = selectedAgent()?.name || 'Choose an agent'; } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && recognitionActive) recognition?.stop(); else if (!document.hidden && listeningRequested && !recognitionActive) { try { recognition?.start(); } catch { listeningRequested = false; } } });
    window.addEventListener('beforeunload', () => { listeningRequested = false; recognition?.stop(); stopMedia(); window.HexiGridLiveVoice?.stop(); });
  }

  window.addEventListener('hexigrid:rendered', () => { mount(); renderSelectors(); renderSavedTranscripts(); });
  window.HexiGridLiveCall = Object.freeze({ selectedAgent, selectedRoom, setStatus, renderSelectors, activeMediaStream });
  bind();
  setTimeout(mount, 0);
})();
