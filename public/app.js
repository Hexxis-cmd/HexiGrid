const state = {
  data: null,
  activeView: "overview",
  activeRoomId: null,
  editingAgentId: null,
  avatarDraft: "",
  avatarModelDraft: null,
  avatarModelFile: null,
  avatarModelRemove: false,
  avatarModelObjectUrl: "",
  onboardingStep: 0,
  network: null,
  usagePeriod: "week",
  deferredInstallPrompt: null,
  workspaceFolder: "/",
  workspaceLoaded: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function migrateLocalPreferences() {
  for (const key of ['theme', 'motion', 'compact', 'button-sounds']) {
    const current = localStorage.getItem(`hexigrid-${key}`);
    const legacy = localStorage.getItem(`aveniq-${key}`);
    if (current === null && legacy !== null) localStorage.setItem(`hexigrid-${key}`, legacy);
  }
}

async function prepareDevelopmentSession() {
  try {
    const response = await fetch('/api/system/identity', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return;
    const identity = await response.json();
    if (!identity.developmentFreshStart || !identity.instanceId) return;
    const sessionKey = 'hexigrid-development-session';
    if (localStorage.getItem(sessionKey) === identity.instanceId) return;
    for (const key of Object.keys(localStorage)) if (key.startsWith('hexigrid-') || key.startsWith('aveniq-')) localStorage.removeItem(key);
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('hexigrid-') || key.startsWith('aveniq-')) sessionStorage.removeItem(key);
    localStorage.setItem(sessionKey, identity.instanceId);
  } catch {
    // A development convenience must never prevent the normal app from opening.
  }
}
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const isHostBrowser = () => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname.toLowerCase());
const isStandaloneBrowser = () => Boolean(window.HexiGridStandalone?.isActive());
function protectHostOnlyControls(root, message = 'Open HexiGrid on the computer that runs it to configure credentials or install local code.') {
  if (isHostBrowser() || !root) return true;
  root.querySelectorAll('input, textarea, select, button').forEach((control) => {
    control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
  });
  if (!root.querySelector('.host-only-notice')) root.insertAdjacentHTML('afterbegin', `<p class="host-only-notice" role="note">${escapeHtml(message)}</p>`);
  return false;
}
const initials = (name) => String(name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const timeAgo = (date) => {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
};
const statusLabel = (status) => ({ connected: "Connected", local_ready: "Local ready", not_connected: "Not connected", setup: "Needs setup" })[status] || "Needs setup";
const statusClass = (status) => status === "connected" ? "connected" : status === "local_ready" ? "local_ready" : "";

class ApiError extends Error {
  constructor(message, body, status) { super(message); this.body = body; this.status = status; }
}

async function api(url, options = {}) {
  if (isStandaloneBrowser()) return window.HexiGridStandalone.request(url, options);
  const csrf = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('hexigrid_csrf='))?.slice('hexigrid_csrf='.length) || '';
  const { headers: optionHeaders, ...requestOptions } = options;
  let response;
  try {
    response = await fetch(url, { ...requestOptions, headers: { "content-type": "application/json", ...(csrf ? { "x-hexigrid-csrf": decodeURIComponent(csrf) } : {}), ...(optionHeaders || {}) } });
  } catch (error) {
    if (!window.HexiGridStandalone) throw error;
    window.HexiGridStandalone.activate();
    return window.HexiGridStandalone.request(url, options);
  }
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json().catch(() => ({})) : await response.text().catch(() => '');
  if (window.HexiGridStandalone?.shouldFallback(response, body, contentType)) {
    window.HexiGridStandalone.activate();
    return window.HexiGridStandalone.request(url, options);
  }
  if (!response.ok) throw new ApiError(body.error || `Request failed (${response.status})`, body, response.status);
  return body;
}

async function userConfirm(title, message, accept = "Continue", danger = false) {
  if (typeof window.hexigridModal === "function") return Boolean(await window.hexigridModal({ title, message, accept, danger }));
  return false;
}

async function userInput(title, label, value = "", options = {}) {
  if (typeof window.hexigridModal !== "function") return null;
  const result = await window.hexigridModal({ title, message: options.message || "", accept: options.accept || "Save", fields: [{ label, value, required: options.required !== false, type: options.type || "text", multiline: options.multiline === true }] });
  return result ? result[0] : null;
}

function notify(message, error = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show${error ? " error" : ""}`;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.className = "toast"; }, 4200);
}

function agent(agentId) { return state.data.agents.find((item) => item.id === agentId); }
function activeRoom() { return state.data.rooms.find((room) => room.id === state.activeRoomId) || state.data.rooms[0]; }
function approvalProfile(profileId) { return state.data.policyCatalog.approvalProfiles.find((profile) => profile.id === profileId); }
function workMode(modeId) { return state.data.policyCatalog.workModes.find((mode) => mode.id === modeId); }
function availableModels() { return [...state.data.modelCatalog, ...(state.data.providers || []).filter(p=>p.enabled).flatMap(p=>p.modelIds.map(model=>({ id:`provider:${p.id}:${model}`, label:`${p.kind === 'browser-webllm' ? 'This device' : p.name} / ${model}`, free:p.local, provider:p.name, providerId:p.id, remoteModel:model, browser:p.kind === 'browser-webllm', cloud:!p.local, local:p.local, modelMeta:p.modelMeta?.find((item) => item.id === model) || null })))]; }
function modelInfo(modelId) { return availableModels().find((model) => model.id === modelId); }
function modelAllowedByPreference(model) { return state.data.settings.modelPolicy !== 'free-only' || model.free; }
function modelOptions(selected) {
  return availableModels().map((model) => `<option value="${escapeHtml(model.id)}" ${model.id === selected ? "selected" : ""} ${modelAllowedByPreference(model) ? '' : 'disabled'}>${escapeHtml(model.label)}${model.free ? ' · no cost' : ''}</option>`).join("");
}

function safeAgentColor(value) { return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : "#8d7dff"; }
function colorTile(value, className = "avatar-color-layer") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="${safeAgentColor(value)}" d="M0 0h1v1H0z"/></svg>`;
  return `<img class="${className}" src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="" aria-hidden="true" />`;
}
function levelClass(value, maximum = 100) { return `level-${Math.max(0, Math.min(20, Math.round((Number(value) || 0) / Math.max(1, maximum) * 20)))}`; }

function avatarMarkup(item, className = "agent-avatar") {
  const fallback = escapeHtml(item.avatar || initials(item.name));
  if (item.avatarImage) return `<div class="${className} has-photo">${colorTile(item.color)}<img class="avatar-photo" src="${escapeHtml(item.avatarImage)}" alt="${escapeHtml(item.name)} profile picture" /></div>`;
  return `<div class="${className}">${colorTile(item.color)}<span class="avatar-initials">${fallback}</span></div>`;
}

const guideTopics = window.HEXIGRID_GUIDES || {};


function renderOverview() {
  const agents = state.data.agents;
  const settings = state.data.settings;
  const goal = settings.activeGoal;
  $("#metricAgents").textContent = agents.length;
  $("#metricAgentsMeta").textContent = agents.length ? `${agents.filter((item) => item.status === "local_ready").length} ready for local testing` : "Add your first agent";
  $("#metricConnected").textContent = agents.filter((item) => item.status === "connected").length;
  $("#metricRooms").textContent = state.data.rooms.length;
  $("#syncMetric").textContent = settings.sync.enabled ? "Encrypted" : "Off";
  $("#agentCountNav").textContent = agents.length;
  $("#activeGoalTitle").textContent = goal?.title || "No active goal";
  $("#activeGoalMeta").textContent = goal?.title ? `${goal.status} · shared with subagents` : "Set a goal when you want agents to keep working toward one outcome.";
  $("#postureMode").textContent = workMode(settings.workMode)?.label || "Converse";
  $("#postureApproval").textContent = approvalProfile(settings.approvalPolicy)?.label || "Approve for me";
  $("#postureSubagents").textContent = settings.subagents.enabled ? `Up to ${settings.subagents.maxConcurrent}` : "Disabled";
  $("#overviewAgents").innerHTML = agents.length ? agents.slice(0, 8).map(renderAgentCard).join("") : `<div class="panel empty-overview"><div class="empty-core"><span>+</span></div><div><strong>Connect your first agent</strong><p>Bring in an account or create a local personality. Nothing appears here until you add it.</p></div><button class="primary-button" data-action="open-connect-agent">Connect or create</button></div>`;
  const icons = { chat: "chat", room: "chat", policy: "shield", assistant: "assistant", communication: "speech", model: "models", workspace: "workspace", terminal: "terminal", agent: "agents", system: "activity" };
  $("#activityList").innerHTML = state.data.activity.slice(0, 8).map((event) => `<div class="activity-item"><div class="activity-icon" data-icon="${icons[event.kind] || 'activity'}"></div><div class="activity-text">${escapeHtml(event.text)}<span class="activity-time">${timeAgo(event.createdAt)}</span></div></div>`).join("") || `<div class="empty-state">No activity yet.</div>`;
}


function renderUsage() {
  const days = state.usagePeriod === "day" ? 1 : state.usagePeriod === "month" ? 30 : 7;
  const filter = $("#usageAgentFilter")?.value || "all";
  const cutoff = Date.now() - days * 86400000;
  const usage = (state.data.usage || []).filter((item) => new Date(item.createdAt).getTime() >= cutoff && (filter === "all" || item.agentId === filter));
  const totalInput = usage.reduce((sum, item) => sum + item.inputTokens, 0);
  const totalOutput = usage.reduce((sum, item) => sum + item.outputTokens, 0);
  $("#usageTotal").textContent = (totalInput + totalOutput).toLocaleString();
  $("#usageInput").textContent = totalInput.toLocaleString();
  $("#usageOutput").textContent = totalOutput.toLocaleString();
  $("#usageChartTitle").textContent = days === 1 ? "Today by hour" : `Last ${days} days`;
  $$('[data-usage-period]').forEach((button) => button.classList.toggle("active", button.dataset.usagePeriod === state.usagePeriod));
  const select = $("#usageAgentFilter");
  const selected = select.value || "all";
  select.innerHTML = `<option value="all">All agents</option>${state.data.agents.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
  select.value = selected;
  const buckets = [];
  const count = days === 1 ? 12 : days;
  const interval = days === 1 ? 2 * 3600000 : 86400000;
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = Date.now() - (index + 1) * interval;
    const end = start + interval;
    const items = usage.filter((item) => { const time = new Date(item.createdAt).getTime(); return time >= start && time < end; });
    const value = items.reduce((sum, item) => sum + item.inputTokens + item.outputTokens, 0);
    const date = new Date(end);
    buckets.push({ value, label: days === 1 ? date.toLocaleTimeString([], { hour: "numeric" }) : date.toLocaleDateString([], { month: "short", day: "numeric" }) });
  }
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));
  $("#usageChart").innerHTML = buckets.map((bucket) => `<button class="usage-bar-wrap" title="${bucket.label}: ${bucket.value.toLocaleString()} tokens"><span class="usage-bar-value">${bucket.value ? bucket.value.toLocaleString() : ""}</span><i class="${levelClass(bucket.value, max)}"></i><small>${bucket.label}</small></button>`).join("");
  const groups = new Map();
  for (const item of usage) {
    const key = item.agentId || "assistant";
    groups.set(key, (groups.get(key) || 0) + item.inputTokens + item.outputTokens);
  }
  $("#usageAgentBreakdown").innerHTML = [...groups.entries()].sort((a,b) => b[1]-a[1]).map(([key, value]) => { const item = agent(key); const name = item?.name || "HexiGrid assistant"; return `<div class="usage-agent-row">${item ? avatarMarkup(item, "agent-avatar compact-avatar") : `<div class="agent-avatar compact-avatar" data-icon="assistant"></div>`}<div><strong>${escapeHtml(name)}</strong><small>${value.toLocaleString()} estimated tokens</small></div><div class="usage-meter"><i class="${levelClass(value, Math.max(1,totalInput+totalOutput))}"></i></div><b>${Math.round(value / Math.max(1,totalInput+totalOutput) * 100)}%</b></div>`; }).join("") || `<div class="empty-state">Usage appears after a local model answers.</div>`;
  $("#usageLegend").innerHTML = `<span><i></i>${usage.some(item=>item.estimated) ? 'Includes estimates' : usage.length ? 'Provider-reported tokens' : 'No requests yet'}</span>`;
}



function renderModels() {
  const selected = state.data.settings.model;
  const options = modelOptions(selected);
  $("#globalModelSelect").innerHTML = options;
  $("#defaultModelSelect").innerHTML = options;
  $("#modelPolicySelect").value = state.data.settings.modelPolicy || 'free-only';
  $("#modelCatalog").innerHTML = availableModels().map((model) => `<button class="model-card ${model.id === selected ? "active" : ""} ${modelAllowedByPreference(model) ? '' : 'model-blocked'}" data-action="choose-model" data-model="${escapeHtml(model.id)}" ${modelAllowedByPreference(model) ? '' : 'disabled'}><span class="model-status"></span><div><strong>${escapeHtml(model.label)}</strong><small>${escapeHtml(model.id)}</small></div><span class="free-tag">${model.browser ? "IN BROWSER" : model.free ? "NO COST" : model.cloud ? "CONNECTED" : "LOCAL"}</span></button>`).join("") || `<div class="panel empty-state"><strong>No models connected</strong><p>Open Connections and choose an API key, local model app, detected signed-in computer tool, or This device.</p></div>`;
  $("#agentModelList").innerHTML = state.data.agents.length ? state.data.agents.map((item) => `<div class="agent-model-row">${avatarMarkup(item, "agent-avatar compact-avatar")}<div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.accountLabel)}</small></div><select data-agent-model="${item.id}">${modelOptions(item.model || selected)}</select></div>`).join("") : `<div class="empty-state">Add an agent to assign a model.</div>`;
}

function renderSetup() {
  const bridge = state.data.bridge;
  const badge = $("#bridgeBadge");
  badge.textContent = bridge.runnerInstalled ? "RUNNER DETECTED" : "RUNNER NOT DETECTED";
  badge.className = `status-badge ${bridge.runnerInstalled ? "" : "warn"}`;
  $("#bridgeDetails").innerHTML = `<div class="bridge-line"><span>AI connections</span><strong>${(state.data.providers?.length||0)+(state.data.harnesses?.filter(item=>item.connected).length||0)}</strong></div><div class="bridge-line"><span>Runtime</span><strong>${bridge.standaloneBrowser ? 'Standalone browser · no desktop' : 'Local HexiGrid service'}</strong></div><div class="bridge-line"><span>iLands Runner</span><strong class="bridge-value ${bridge.runnerInstalled ? "ok" : "warn"}">${bridge.runnerInstalled ? "Detected" : bridge.standaloneBrowser ? 'Needs an optional host' : "Install through BYOA"}</strong></div><div class="bridge-line"><span>iLands access</span><strong class="bridge-value warn">Runner identity + world runtime</strong></div><div class="bridge-line"><span>Room messages</span><strong>Local to HexiGrid</strong></div><div class="bridge-line"><span>Default model</span><strong>${escapeHtml(modelInfo(bridge.model)?.label || bridge.model || 'Choose a model')}</strong></div><div class="bridge-line"><span>Model choice</span><strong>${state.data.settings.modelPolicy === 'free-only' ? 'No-cost only' : 'All connected models'}</strong></div>${bridge.port ? `<div class="bridge-line"><span>Local address</span><strong>127.0.0.1:${bridge.port}</strong></div>` : ''}`;
  const policy = document.querySelector('#view-setup .model-policy'); if(policy) policy.innerHTML = `<span class="policy-check">✓</span><div><strong>${state.data.settings.modelPolicy === 'free-only' ? 'No-cost guard is on' : 'All connected models are allowed'}</strong><p>${state.data.settings.modelPolicy === 'free-only' ? 'Metered OpenCode and cloud models cannot be selected.' : 'HexiGrid will use a paid model only when you select it.'}</p></div>`;
  $("#setupSteps").innerHTML = state.data.guide.steps.map((step, index) => `<div class="setup-step"><span class="step-number">${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(step)}</strong></div></div>`).join("");
  const profiles = state.data.runnerProfiles || [];
  $("#setupRoster").innerHTML = profiles.length ? profiles.map((profile) => `<div class="setup-roster-row"><div><strong>${escapeHtml(profile.label)}</strong><small>${escapeHtml(profile.harness)}</small></div><span>${profile.agentId ? "Account linked" : "Setup needed"}</span><span>${profile.runtime?.running ? "Runner active" : "Runner stopped"}</span><button class="ghost-button" data-view-target="integrations">Manage ↗</button></div>`).join("") : `<div class="empty-state">No iLands connections yet. Add one in Connections & tools.</div>`;
}

function renderAccess() {
  const settings = state.data.settings;
  const catalog = state.data.policyCatalog;
  $("#workModeSelect").innerHTML = catalog.workModes.map((mode) => `<option value="${mode.id}" ${mode.id === settings.workMode ? "selected" : ""}>${escapeHtml(mode.label)}</option>`).join("");
  $("#approvalSelect").innerHTML = catalog.approvalProfiles.map((profile) => `<option value="${profile.id}" ${profile.id === settings.approvalPolicy ? "selected" : ""}>${escapeHtml(profile.label)}</option>`).join("");
  $("#modeCards").innerHTML = catalog.workModes.map((mode) => `<button class="mode-card ${mode.id === settings.workMode ? "active" : ""}" data-action="choose-mode" data-mode="${mode.id}"><span class="mode-symbol" data-icon="${({ converse: 'converse', setup: 'settings', plan: 'plan', goal: 'goal', sketch: 'sketch', research: 'research', build: 'build', watch: 'watch' })[mode.id] || 'models'}"></span><strong>${escapeHtml(mode.label)}</strong><small>${escapeHtml(mode.description)}</small><span class="capability-count">${mode.capabilities.length} allowed actions</span></button>`).join("");
  $("#approvalCards").innerHTML = catalog.approvalProfiles.map((profile) => `<button class="approval-card ${profile.id === settings.approvalPolicy ? "active" : ""}" data-action="choose-approval" data-approval="${profile.id}"><span class="approval-radio"></span><span><strong>${escapeHtml(profile.label)}</strong><small>${escapeHtml(profile.description)}</small></span></button>`).join("");
  $("#goalInput").value = settings.activeGoal?.title || "";
  $("#subagentsEnabled").checked = settings.subagents.enabled;
  $("#subagentLimit").value = settings.subagents.maxConcurrent;
  $("#terminalMode").textContent = `${workMode(settings.workMode)?.label || "Converse"} · ${approvalProfile(settings.approvalPolicy)?.label || "Review"}`;
}

function renderActivity() {
  const search = $("#activitySearch").value.trim().toLowerCase();
  const filter = $("#activityFilter").value;
  const receipts = (state.data.receipts || []).map((receipt) => ({ id: receipt.id, kind: receipt.source || 'tool', text: `${receipt.action}: ${receipt.detail}`, createdAt: receipt.createdAt, receiptStatus: receipt.status, risk: receipt.risk }));
  const events = [...receipts, ...state.data.activity].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).filter((event) => {
    const kindMatch = filter === "all" || event.kind === filter || (filter === "workspace" && ["workspace", "terminal"].includes(event.kind));
    return kindMatch && (!search || `${event.kind} ${event.text}`.toLowerCase().includes(search));
  });
  const icons = { agent: "agents", chat: "chat", room: "chat", workspace: "workspace", terminal: "terminal", policy: "shield", model: "models", assistant: "assistant", communication: "speech", system: "activity" };
  $("#activityResultCount").textContent = `${events.length} receipt${events.length === 1 ? "" : "s"}`;
  $("#activityTimeline").innerHTML = events.map((event) => `<article class="timeline-event"><div class="timeline-glyph" data-icon="${icons[event.kind] || 'activity'}"></div><div><div class="timeline-meta"><span>${escapeHtml(event.kind || "system")}${event.risk ? ` · ${escapeHtml(event.risk)} risk` : ''}</span><time>${timeAgo(event.createdAt)}</time></div><p>${escapeHtml(event.text)}</p><small>${new Date(event.createdAt).toLocaleString()}</small></div><span class="receipt-status ${event.receiptStatus === 'failed' ? 'deny' : event.receiptStatus === 'waiting_approval' ? 'ask' : 'complete'}">${escapeHtml(event.receiptStatus === 'failed' ? 'Failed' : event.receiptStatus === 'waiting_approval' ? 'Approval' : 'Completed')}</span></article>`).join("") || `<div class="empty-state">No activity matches this search.</div>`;
}


function renderSettings() {
  const owner = state.data.settings.owner || { displayName: "Owner", avatarImage: "" };
  $("#ownerName").value = owner.displayName || "Owner";
  const ownerAvatar = $("#ownerAvatar");
  ownerAvatar.innerHTML = owner.avatarImage ? `<img src="${escapeHtml(owner.avatarImage)}" alt="Owner profile picture" />` : escapeHtml(initials(owner.displayName || "Owner"));
  const theme = localStorage.getItem("hexigrid-theme") || "aurora-dark";
  $$('[data-theme-choice]').forEach((card) => card.classList.toggle("active", card.dataset.themeChoice === theme));
  $("#motionEnabled").checked = localStorage.getItem("hexigrid-motion") !== "off";
  $("#buttonSoundsEnabled").checked = window.HexiInteractions?.soundsEnabled() !== false;
  $("#compactMode").checked = localStorage.getItem("hexigrid-compact") === "on";
  const installButton = $("#installPwaBtn");
  const standalone = matchMedia("(display-mode: standalone)").matches;
  installButton.textContent = standalone ? "Installed on this device" : state.deferredInstallPrompt ? "Install on this device" : "Installation help";
  installButton.disabled = standalone;
}

function renderNetwork() {
  const network = state.network;
  if (!network) return;
  const badge = $("#networkBadge");
  const button = $("#copyMobileAddress");
  const remoteButton = $("#remoteLinkButton");
  if (network.standaloneBrowser) {
    badge.textContent = "STANDALONE";
    badge.className = "status-badge";
    $("#networkDescription").textContent = "This browser works independently for direct-capable cloud APIs and supported on-device models. Pair a host only for desktop files, CLIs, isolated tools, or background work.";
    $("#networkDetails").innerHTML = `<div><span>Cloud requests</span><strong>Direct from this browser</strong></div><div><span>Local protection</span><strong>Passcode-derived AES-256 vault</strong></div>`;
    button.disabled = true;
    remoteButton.disabled = true;
    return;
  }
  remoteButton.disabled = false;
  remoteButton.textContent = network.tunnel?.running ? "Close temporary remote link" : network.tunnel?.starting ? "Opening remote link…" : "Open temporary remote link";
  if (network.tunnel?.running) {
    badge.textContent = "REMOTE LINK OPEN";
    badge.className = "status-badge warn";
    $("#networkDescription").textContent = "This temporary public link closes when HexiGrid stops. Anyone opening it must enter the pairing code and then sign in.";
    $("#networkDetails").innerHTML = `<div><span>Temporary address</span><strong>${escapeHtml(network.tunnel.url)}</strong></div><div><span>Pairing code</span><strong>${escapeHtml(network.pairingCode || "Shown only on the host computer")}</strong></div>`;
    button.disabled = !network.pairingCode;
    return;
  }
  if (!network.enabled) {
    badge.textContent = "LOCAL ONLY";
    badge.className = "status-badge warn";
    $("#networkDescription").textContent = "Phone access is off. Restart with private-network access when both devices are on Wi-Fi you trust.";
    $("#networkDetails").innerHTML = `<div><span>Windows shortcut</span><strong>Use “Open on phone”</strong></div><div><span>Command</span><strong>Start-Control-Room.ps1 -Network</strong></div>`;
    button.disabled = true;
    return;
  }
  badge.textContent = "READY TO PAIR";
  badge.className = "status-badge";
  $("#networkDescription").textContent = "Choose an address below while your phone is on the same private network. The pairing code changes whenever HexiGrid restarts.";
  $("#networkDetails").innerHTML = network.urls.length ? network.urls.map((url) => `<div><span>Phone address</span><strong>${escapeHtml(url)}</strong></div>`).join("") + `<div><span>Pairing code</span><strong>${escapeHtml(network.pairingCode || "Open this page on the computer")}</strong></div>` : `<div><span>No private address found</span><strong>Check Windows network settings</strong></div>`;
  button.disabled = !network.urls.length || !network.pairingCode;
}

function applyTheme(theme) {
  const valid = ["system-dark", "system-light", "aurora-dark", "aurora-light"];
  const selected = valid.includes(theme) ? theme : "aurora-dark";
  document.documentElement.dataset.theme = selected;
  localStorage.setItem("hexigrid-theme", selected);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", selected.endsWith("light") ? "#eef5f5" : "#071110");
  if (state.data) renderSettings();
}

function applyDevicePreferences() {
  const motion = localStorage.getItem("hexigrid-motion") !== "off";
  const compact = localStorage.getItem("hexigrid-compact") === "on";
  document.body.classList.toggle("reduce-motion", !motion);
  document.body.classList.toggle("compact-ui", compact);
  document.body.classList.toggle("touch-device", matchMedia("(pointer: coarse)").matches);
  document.body.classList.toggle("mobile-device", /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
}

function renderDeviceNotice() {
  const isPhone = matchMedia("(max-width: 900px)").matches || document.body.classList.contains("mobile-device");
  const notice = $("#deviceNotice");
  if (!isPhone || sessionStorage.getItem("hexigrid-device-notice") === "hidden") return notice.classList.add("hidden");
  const messages = {
    workspace: "Files and commands run on the linked HexiGrid computer. Your phone safely controls them from here.",
    models: "Local AI models run on the linked computer. Your phone can still choose and use them.",
    setup: "Windows-only runners stay on the linked computer. Phone controls remain available after pairing."
  };
  if (!messages[state.activeView]) return notice.classList.add('hidden');
  $("#deviceNoticeText").textContent = messages[state.activeView];
  notice.classList.remove("hidden");
}

function renderAll({ preserveCommunication = false } = {}) {
  if (!state.data) return;
  renderAccess();
  renderOverview();
  renderAgents();
  renderRooms();
  renderModels();
  renderSetup();
  renderActivity();
  renderUsage();
  if (typeof renderProviders === 'function') renderProviders();
  if (typeof renderTasks === 'function') renderTasks();
  if (typeof renderPlugins === 'function') renderPlugins();
  if (typeof renderSecurity === 'function') renderSecurity();
  renderGuide();
  renderSettings();
  renderNetwork();
  if (!preserveCommunication) renderCommunication();
  $("#localStatus").textContent = availableModels().length ? "AI ready" : "Choose an AI connection";
  window.dispatchEvent(new CustomEvent("hexigrid:rendered"));
}

function showView(view) {
  state.activeView = view;
  document.body.classList.remove("nav-open");
  $$(".view").forEach((section) => section.classList.toggle("active-view", section.id === `view-${view}`));
  $$('[data-view]').forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const titles = {
    overview: ["CONTROL ROOM", "Everyone, in one place."],
    agents: ["AGENT PROFILES", "Shape every identity."],
    room: ["GROUP CHAT", "Think together."],
    live: ["LIVE COMMUNICATION", "Talk to one agent."],
    communication: ["GLOBAL STYLE", "Make conversation feel natural."],
    models: ["AI MODEL ROUTING", "Choose each agent's model."],
    workspace: ["PRIVATE SANDBOX", "Create and test locally."],
    assistant: ["PLAIN-LANGUAGE ASSISTANT", "Ask HexiGrid."],
    access: ["PERMISSIONS", "Stay in control."],
    setup: ["ACCOUNTS + DEVICES", "Bring your services together."],
    activity: ["ACTION HISTORY", "See what every agent did."],
    usage: ["AI USAGE", "Understand where model tokens go."],
    providers: ['AI CONNECTIONS', 'Connect what you use.'],
    tasks: ['AUTONOMOUS WORK', 'Keep bounded work moving.'],
    plugins: ['PLUGINS & TOOLS', 'Add capabilities with clear access.'],
    guide: ["HOW-TO GUIDE", "Learn one clear step at a time."],
    settings: ["SETTINGS", "Make HexiGrid yours."]
  };
  $("#viewEyebrow").textContent = titles[view]?.[0] || PRODUCT.name.toUpperCase();
  $("#viewTitle").textContent = titles[view]?.[1] || "Control room";
  renderDeviceNotice();
  if (view === "workspace" && !state.workspaceLoaded) loadWorkspace("/", true);
}

async function updateSettings(patch, message, preserveCommunication = false) {
  try {
    const response = await api("/api/settings", { method: "PATCH", body: JSON.stringify(patch) });
    state.data.settings = response.settings;
    state.data.bridge.model = response.settings.model;
    renderAll({ preserveCommunication });
    if (message) notify(message);
  } catch (error) { notify(error.message, true); }
}




async function chooseModel(modelId) {
  await updateSettings({ model: modelId }, `${modelInfo(modelId)?.label || modelId} is now the default model.`, true);
}

async function refreshModels() {
  try {
    const response = await api("/api/models/refresh", { method: "POST" });
    state.data.modelCatalog = response.models; state.data.bridge.modelCatalogError=response.error||''; renderModels(); notify(`Found ${response.models.length} current models.`);
  } catch (error) { notify(error.message, true); }
}

async function assignAgentModel(agentId, model) {
  try {
    const response = await api(`/api/agents/${agentId}`, { method: "PATCH", body: JSON.stringify({ model }) });
    const index = state.data.agents.findIndex((item) => item.id === agentId);
    state.data.agents[index] = response.agent; renderAll({ preserveCommunication: true }); notify(`${response.agent.name} will use ${modelInfo(model)?.label || model}.`);
  } catch (error) { notify(error.message, true); }
}

async function askAssistant(event) {
  event.preventDefault();
  const input = $("#assistantInput");
  const content = input.value.trim();
  if (!content) return;
  const messages = $("#assistantMessages");
  messages.insertAdjacentHTML("beforeend", `<div class="assistant-message owner"><strong>You</strong><br>${escapeHtml(content)}</div>`);
  input.value = ""; input.disabled = true;
  try {
    const selected = modelInfo(state.data.settings.model);
    let response;
    if (selected?.browser) {
      if (!window.HexiGridOnDevice?.complete) throw new Error("The browser model engine is unavailable. Refresh the page or choose another model.");
      const generated = await window.HexiGridOnDevice.complete({ modelId: selected.remoteModel, messages: [{ role: "system", content: "You are the local HexiGrid control assistant. Explain setup and agent workflows in plain language. Never claim to have changed anything or used a tool unless the dashboard confirms it." }, { role: "user", content } ] });
      await api("/api/usage/browser", { method: "POST", body: JSON.stringify({ model: state.data.settings.model, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, inputText: content, outputText: generated.content }) });
      response = { content: generated.content, model: state.data.settings.model };
    } else response = await api("/api/assistant", { method: "POST", body: JSON.stringify({ content }) });
    messages.insertAdjacentHTML("beforeend", `<div class="assistant-message"><strong>HexiGrid · ${escapeHtml(modelInfo(response.model)?.label || response.model)}</strong><br>${escapeHtml(response.content)}</div>`);
  } catch (error) { messages.insertAdjacentHTML("beforeend", `<div class="assistant-message error-message"><strong>Unavailable</strong><br>${escapeHtml(error.message)}</div>`); }
  finally { input.disabled = false; messages.scrollTop = messages.scrollHeight; }
}



function renderOnboarding() {
  const step = Math.max(0, Math.min(5, state.onboardingStep));
  $$('[data-onboarding-step]').forEach((section) => section.classList.toggle("hidden", Number(section.dataset.onboardingStep) !== step));
  $("#onboardingProgressBar").className = `onboarding-progress-${step}`;
  $("#onboardingDots").innerHTML = Array.from({ length: 6 }, (_, index) => `<i class="${index === step ? "active" : ""}"></i>`).join("");
  $("#onboardingBack").classList.toggle("hidden", step === 0 || step === 5);
  $("#onboardingNext").classList.toggle("hidden", step === 5);
  $("#onboardingNext").textContent = step === 0 ? "Begin setup" : step === 4 ? "Finish" : "Continue";
  $("#onboardingOwnerName").value = step === 1 ? (state.data.settings.owner?.displayName || "Owner") : $("#onboardingOwnerName").value;
  const models = availableModels().filter(model=>model.free).slice(0, 3);
  $("#onboardingModelStatus").textContent = availableModels().length ? `${availableModels().length} model${availableModels().length===1?' is':'s are'} ready from connections you chose.` : "Nothing is connected yet. Choose an API key, a local model app, or a detected signed-in computer tool.";
  $("#onboardingModelList").innerHTML = models.map((model) => `<span>${escapeHtml(model.label)} <strong>No cost</strong></span>`).join("") || `<span>Model connection <strong>Needed</strong></span>`;
}

function showOnboarding(start = 0) {
  state.onboardingStep = start;
  renderOnboarding();
  $("#onboarding").classList.remove("hidden");
  document.body.classList.add("overlay-open");
}

async function finishOnboarding(destination = null) {
  const displayName = $("#onboardingOwnerName").value.trim() || state.data.settings.owner?.displayName || "Owner";
  await updateSettings({ owner: { displayName }, setupAcknowledged: true }, "Welcome to HexiGrid.", true);
  $("#onboarding").classList.add("hidden");
  document.body.classList.remove("overlay-open");
  if (destination) showView(destination);
}

async function loadNetwork() {
  try { state.network = await api("/api/network"); renderNetwork(); }
  catch { state.network = { enabled: false, urls: [], pairingCode: "" }; }
}

async function copyMobileAddress() {
  const url = state.network?.tunnel?.running ? state.network.tunnel.url : state.network?.urls?.[0];
  const code = state.network?.pairingCode;
  if (!url || !code) return notify("Turn on private-network mode first.", true);
  const pairingUrl = `${url}/?pair=${encodeURIComponent(code)}`;
  try { await navigator.clipboard.writeText(pairingUrl); notify("Private phone pairing link copied."); }
  catch { await userInput("Phone address", "Copy this address", pairingUrl, { required: false, accept: "Done" }); }
}

async function toggleRemoteLink() {
  const running = state.network?.tunnel?.running;
  if (running) {
    if (!await userConfirm("Close remote link?", "Devices using the temporary link will disconnect now.", "Close link", true)) return;
    await api('/api/network/tunnel', { method: 'DELETE', body: JSON.stringify({ approved: true }) });
    notify('Temporary remote link closed.');
  } else {
    if (!await userConfirm("Open a temporary remote link?", "This uses Cloudflare Quick Tunnel. The random link is public, but HexiGrid still requires the pairing code and your owner sign-in. Use Connect mode, and close it when the call ends.", "Open link")) return;
    const result = await api('/api/network/tunnel', { method: 'POST', body: JSON.stringify({ approved: true }) });
    notify('Temporary remote link opened.');
    state.network = { ...state.network, tunnel: result.tunnel, pairingCode: result.pairingCode };
  }
  await loadNetwork();
}

async function installPwa() {
  if (matchMedia("(display-mode: standalone)").matches) return;
  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    return renderSettings();
  }
  openGuideTopic("mobile");
  notify(location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "Use your browser menu and choose Install app or Add to home screen." : "A private HTTP address can be bookmarked. Full PWA installation needs localhost or HTTPS.");
}

async function refresh() {
  try {
    state.data = await api("/api/bootstrap");
    document.body.classList.toggle('standalone-browser', isStandaloneBrowser());
    if (!activeRoom()) state.activeRoomId = state.data.rooms[0]?.id;
    renderAll();
    await loadNetwork();
    if (window.hexigridAuthInitialized && !state.data.settings.setupAcknowledged && $("#onboarding").classList.contains("hidden") && $("#authGate").classList.contains("hidden")) showOnboarding(0);
  } catch (error) {
    if (error.status === 401 && error.body?.authRequired && typeof window.showAuthGate === 'function') window.showAuthGate();
    else notify(`HexiGrid could not load: ${error.message}`, true);
  } finally { window.hexigridBoot?.complete(); }
}

document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav) return showView(nav.dataset.view);
  const target = event.target.closest("[data-action], [data-view-target], [data-usage-period]");
  if (!target) return;
  if (target.dataset.viewTarget) return showView(target.dataset.viewTarget);
  const action = target.dataset.action;
  if (action === "open-add-agent") openAgentModal();
  if (action === "open-connect-agent") openConnectModal();
  if (action === "close-connect-modal") closeConnectModal();
  if (action === "choose-agent-source" && target.dataset.source === "ilands") { closeConnectModal(); showView("integrations"); }
  if (action === "choose-agent-source" && target.dataset.source === "local") { closeConnectModal(); openAgentModal(); $("#transport").value = "local-opencode"; }
  if (action === "copy-byoa-instruction") { const instruction = "Open https://ilands.ai/agent.md and connect this local agent to iLands. Detect this machine's OS and architecture first, then follow only a platform branch and Harness that the live guide reports as certified. Complete other in-scope steps automatically; only ask me for browser login/approval, permissions, platform prerequisites, and onboarding answers."; try { await navigator.clipboard.writeText(instruction); notify("Official BYOA setup instruction copied."); } catch { await userInput("BYOA setup instruction", "Copy this instruction", instruction, { required: false, multiline: true, accept: "Done" }); } }
  if (action === "finish-ilands-profile") { closeConnectModal(); openAgentModal(); $("#transport").value = "ilands-runner"; }
  if (action === "onboarding-connect-agent") { $("#onboarding").classList.add("hidden"); openConnectModal(); }
  if (action === "close-modal") closeAgentModal();
  if (action === "edit-agent") openAgentModal(target.dataset.agentId);
  if (action === "duplicate-agent") duplicateAgent(target.dataset.agentId);
  if (action === "new-room") newRoom();
  if (action === "rename-room") renameRoom();
  if (action === "select-room") { state.activeRoomId = target.dataset.roomId; renderRooms(); }
  if (action === "choose-mode") updateSettings({ workMode: target.dataset.mode }, `${workMode(target.dataset.mode)?.label} mode is active.`, true);
  if (action === "choose-approval") updateSettings({ approvalPolicy: target.dataset.approval }, `${approvalProfile(target.dataset.approval)?.label} is active.`, true);
  if (action === "save-subagents") updateSettings({ subagents: { enabled: $("#subagentsEnabled").checked, maxConcurrent: Number($("#subagentLimit").value) } }, "Subagent limits saved.", true);
  if (action === "clear-goal") updateSettings({ activeGoal: { title: "" } }, "Goal cleared.", true);
  if (action === "focus-composer") { showView("room"); $("#chatInput").focus(); }
  if (action === "refresh-bridge") { await refresh(); notify("Local connections checked."); }
  if (action === "refresh-models") refreshModels();
  if (action === "choose-model") chooseModel(target.dataset.model);
  if (action === "add-communication-example") addCommunicationExample();
  if (action === "remove-communication-example") removeCommunicationExample(target.dataset.exampleIndex);
  if (action === "save-communication") saveCommunication();
  if (action === "reset-communication") { renderCommunication(state.data.communicationDefaults); notify("Default draft restored. Save when it looks right."); }
  if (action === "preview-communication") previewCommunication();
  if (action === "open-workspace-folder") loadWorkspace(target.dataset.path);
  if (action === "open-workspace-file") openWorkspaceFile(target.dataset.path);
  if (action === "workspace-up") {
    const parts = state.workspaceFolder.split("/").filter(Boolean); parts.pop(); loadWorkspace(`/${parts.join("/")}`);
  }
  if (action === "save-workspace-file") saveWorkspaceFile();
  if (action === "configure-google") { showView("settings"); document.querySelector('#syncTools')?.scrollIntoView({ behavior: 'smooth' }); }
  if (action === "future-provider") { showView("plugins"); notify("Install a connector or tool from a local plugin bundle."); }
  if (action === "toggle-mobile-nav") document.body.classList.toggle("nav-open");
  if (action === "close-mobile-nav") document.body.classList.remove("nav-open");
  if (action === "dismiss-device-notice") { sessionStorage.setItem("hexigrid-device-notice", "hidden"); $("#deviceNotice").classList.add("hidden"); }
  if (action === "open-guide-topic") openGuideTopic(target.dataset.guide);
  if (action === "open-guide-from-onboarding") openGuideTopic(target.dataset.guide);
  if (action === "copy-integration-prompt") {
    const prompt = guideTopics[target.dataset.guide]?.prompt;
    if (prompt) {
      try { await navigator.clipboard.writeText(prompt); notify("Safe setup prompt copied."); }
      catch { await userInput("Safe setup prompt", "Copy this prompt", prompt, { required: false, multiline: true, accept: "Done" }); }
    }
  }
  if (action === "open-connections-from-onboarding") { $("#onboarding").classList.add("hidden"); showView("providers"); }
  if (action === "close-guide-topic") closeGuideTopic();
  if (action === "restart-onboarding") showOnboarding(0);
  if (action === "onboarding-next") { state.onboardingStep = Math.min(5, state.onboardingStep + 1); renderOnboarding(); }
  if (action === "onboarding-back") { state.onboardingStep = Math.max(0, state.onboardingStep - 1); renderOnboarding(); }
  if (action === "skip-onboarding") finishOnboarding();
  if (action === "finish-onboarding") finishOnboarding();
  if (action === "finish-to-guide") finishOnboarding("guide");
  if (action === "save-owner") updateSettings({ owner: { displayName: $("#ownerName").value } }, "Local profile saved.", true);
  if (action === "copy-mobile-address") copyMobileAddress();
  if (action === "toggle-remote-link") toggleRemoteLink().catch((error) => notify(error.message, true));
  if (action === "install-pwa") installPwa();
  if (action === "remove-agent-photo") { state.avatarDraft = ""; renderAgentPhoto(); }
  if (action === "remove-agent-model") { clearAvatarModelDraft(true); renderAgentPhoto(); }
  if (target.dataset.usagePeriod) { state.usagePeriod = target.dataset.usagePeriod; renderUsage(); }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-agent-toggle]")) updateRoomAgents();
  if (event.target.matches("[data-agent-model]")) assignAgentModel(event.target.dataset.agentModel, event.target.value);
  if (event.target.matches("[data-theme-choice]")) applyTheme(event.target.dataset.themeChoice);
});

document.addEventListener("click", (event) => {
  const themeCard = event.target.closest("[data-theme-choice]");
  if (themeCard) applyTheme(themeCard.dataset.themeChoice);
});

$("#workModeSelect").addEventListener("change", (event) => updateSettings({ workMode: event.target.value }, "Work mode changed.", true));
$("#approvalSelect").addEventListener("change", (event) => updateSettings({ approvalPolicy: event.target.value }, "Approval level changed.", true));
$("#globalModelSelect").addEventListener("change", (event) => chooseModel(event.target.value));
$("#defaultModelSelect").addEventListener("change", (event) => chooseModel(event.target.value));
$("#modelPolicySelect").addEventListener("change", (event) => updateSettings({ modelPolicy: event.target.value }, event.target.value === 'free-only' ? 'Only models reported as no-cost can now be selected.' : 'All models from your connected services can now be selected.', true));
$("#refreshBtn").addEventListener("click", refresh);
$("#agentSearch").addEventListener("input", renderAgents);
$("#activitySearch").addEventListener("input", renderActivity);
$("#activityFilter").addEventListener("change", renderActivity);
$("#usageAgentFilter").addEventListener("change", renderUsage);
$("#agentForm").addEventListener("submit", saveAgent);
$("#agentName").addEventListener("input", () => { if (!state.avatarDraft) renderAgentPhoto(); });
$("#agentPhotoInput").addEventListener("change", async (event) => {
  try { state.avatarDraft = await resizeProfileImage(event.target.files?.[0]); renderAgentPhoto(); }
  catch (error) { notify(error.message, true); event.target.value = ""; }
});
$("#agentModelInput").addEventListener("change", (event) => {
  try { chooseAvatarModel(event.target.files?.[0]); renderAgentPhoto(); }
  catch (error) { notify(error.message, true); event.target.value = ""; }
});
$("#deleteAgentBtn").addEventListener("click", deleteAgent);
$("#chatForm").addEventListener("submit", sendChat);
$("#assistantForm").addEventListener("submit", askAssistant);
$("#terminalForm").addEventListener("submit", runTerminal);
$("#goalForm").addEventListener("submit", (event) => { event.preventDefault(); updateSettings({ activeGoal: { title: $("#goalInput").value, status: "active" } }, "Goal saved.", true); });
$("#agentModal").addEventListener("click", (event) => { if (event.target.id === "agentModal") closeAgentModal(); });
$("#connectModal").addEventListener("click", (event) => { if (event.target.id === "connectModal") closeConnectModal(); });
$("#guideDrawer").addEventListener("click", (event) => { if (event.target.id === "guideDrawer") closeGuideTopic(); });
$("#motionEnabled").addEventListener("change", (event) => { localStorage.setItem("hexigrid-motion", event.target.checked ? "on" : "off"); applyDevicePreferences(); });
$("#buttonSoundsEnabled").addEventListener("change", (event) => { window.HexiInteractions?.setSoundsEnabled(event.target.checked, { preview: true }); });
$("#compactMode").addEventListener("change", (event) => { localStorage.setItem("hexigrid-compact", event.target.checked ? "on" : "off"); applyDevicePreferences(); });
window.addEventListener("resize", renderDeviceNotice);
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.deferredInstallPrompt = event; if (state.data) renderSettings(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeAgentModal(); closeGuideTopic(); document.body.classList.remove("nav-open"); } });

async function initialize() {
  await prepareDevelopmentSession();
  migrateLocalPreferences();
  applyTheme(localStorage.getItem("hexigrid-theme") || "aurora-dark");
  applyDevicePreferences();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  await refresh();
}

initialize();
