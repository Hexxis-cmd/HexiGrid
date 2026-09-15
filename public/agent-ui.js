/* Agent roster, profile editor, pictures, duplication, and removal. */
function renderAgentCard(item) {
  const source = item.transport === "local-opencode" ? "Local" : "iLands";
  return `<article class="agent-card"><div class="agent-card-head">${avatarMarkup(item)}<div><h4>${escapeHtml(item.name)}</h4><div class="account">${escapeHtml(item.accountLabel || "No account linked")}</div></div><div class="agent-card-actions"><button class="ghost-button" data-action="edit-agent" data-agent-id="${item.id}">Open</button></div></div><div class="agent-presence"><span class="presence-wave"><i></i><i></i><i></i></span><span>${item.personality ? "Personality ready" : "Personality needs detail"}</span></div><div class="agent-card-footer"><div class="status-label ${statusClass(item.status)}"><span></span>${statusLabel(item.status)}</div><span class="tag">${source}</span></div></article>`;
}

function renderAgents() {
  const query = $("#agentSearch").value.trim().toLowerCase();
  const agents = state.data.agents.filter((item) => `${item.name} ${item.accountLabel} ${item.ilandsAgentId} ${item.transport} ${item.model}`.toLowerCase().includes(query));
  $("#agentsList").innerHTML = agents.length ? agents.map((item) => {
    const connection = item.transport === "local-opencode" ? "Local AI" : `iLands · ${item.harness === "codex" ? "Codex" : "Claude Code"}`;
    const model = modelInfo(item.model)?.label || item.model || "Default";
    return `<article class="agent-row"><div class="agent-row-main">${avatarMarkup(item)}<div><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.accountLabel || "No account label")}</p></div></div><div class="agent-row-detail"><span>CONNECTION</span><strong>${escapeHtml(connection)}</strong></div><div class="agent-row-detail"><span>MODEL</span><strong>${escapeHtml(model)}</strong></div><div class="agent-row-detail"><span>STATUS</span><strong class="${statusClass(item.status)}">${statusLabel(item.status)}</strong></div><div class="row-actions"><button class="mini-button" title="Duplicate agent" data-action="duplicate-agent" data-agent-id="${item.id}">+</button><button class="ghost-button" data-action="edit-agent" data-agent-id="${item.id}">Edit ↗</button></div></article>`;
  }).join("") : state.data.agents.length ? `<div class="panel empty-state">No matching agents.</div>` : `<div class="panel empty-agent-state"><div class="empty-core"><span>+</span></div><div><div class="eyebrow">YOUR TEAM STARTS HERE</div><h3>No agents connected yet</h3><p>Connect an account and its verified agent will appear here, or create an independent local agent.</p><button class="primary-button" data-action="open-connect-agent">Connect or create your first agent</button></div></div>`;
}

function openAgentModal(agentId = null) {
  const item = agentId ? agent(agentId) : null;
  state.editingAgentId = item?.id || null;
  state.avatarDraft = item?.avatarImage || "";
  clearAvatarModelDraft(false);
  state.avatarModelDraft = item?.avatarModel || null;
  state.avatarModelRemove = false;
  $("#modalTitle").textContent = item ? `Edit ${item.name}` : "Add an agent";
  $("#deleteAgentBtn").classList.toggle("hidden", !item);
  $("#agentId").value = item?.id || "";
  const fields = {
    agentName: item?.name || "", accountLabel: item?.accountLabel || "", transport: item?.transport || "ilands-runner",
    harness: item?.harness || "codex", ilandsAgentId: item?.ilandsAgentId || "", runnerHome: item?.runnerHome || "",
    workspacePath: item?.workspacePath || "", personality: item?.personality || "", instructions: item?.instructions || "", rules: item?.rules || ""
  };
  Object.entries(fields).forEach(([key, value]) => { $("#" + key).value = value; });
  $("#agentModel").innerHTML = modelOptions(item?.model || state.data.settings.model);
  $("#agentUseGlobalCommunication").checked = item?.useGlobalCommunication !== false;
  renderAgentPhoto(item?.name || "Agent", item?.color || "#8d7dff");
  $("#agentModal").classList.remove("hidden");
  document.body.classList.add("overlay-open");
  $("#agentName").focus();
}

function openConnectModal() { $("#connectModal").classList.remove("hidden"); document.body.classList.add("overlay-open"); }
function closeConnectModal() { $("#connectModal").classList.add("hidden"); document.body.classList.remove("overlay-open"); }

function closeAgentModal() { $("#agentModal").classList.add("hidden"); state.editingAgentId = null; state.avatarDraft = ""; $("#agentPhotoInput").value = ""; $("#agentModelInput").value = ""; clearAvatarModelDraft(false); document.body.classList.remove("overlay-open"); }

function renderAgentPhoto(name = $("#agentName").value || "Agent", color = "#8d7dff") {
  const preview = $("#agentPhotoPreview");
  preview.innerHTML = state.avatarDraft ? `${colorTile(color)}<img class="avatar-photo" src="${escapeHtml(state.avatarDraft)}" alt="Profile picture preview" />` : `${colorTile(color)}<span class="avatar-initials">${escapeHtml(initials(name))}</span>`;
  const modelPreview = $("#agentModelPreview");
  const modelUrl = state.avatarModelObjectUrl || state.avatarModelDraft?.url;
  modelPreview.innerHTML = modelUrl ? window.HexiGridAvatarViewer.element(modelUrl, `${name} 3D avatar preview`, 'agent-model-viewer') : '<span>3D</span>';
}

function clearAvatarModelDraft(markForRemoval) {
  if (state.avatarModelObjectUrl) URL.revokeObjectURL(state.avatarModelObjectUrl);
  state.avatarModelObjectUrl = "";
  state.avatarModelFile = null;
  state.avatarModelDraft = null;
  state.avatarModelRemove = Boolean(markForRemoval);
}

function chooseAvatarModel(file) {
  if (!file || (!file.name.toLowerCase().endsWith('.glb') && file.type !== 'model/gltf-binary')) throw new Error('Choose a GLB 3D model file.');
  if (file.size < 20 || file.size > 8 * 1024 * 1024) throw new Error('Choose a GLB model smaller than 8 MB.');
  clearAvatarModelDraft(false);
  state.avatarModelFile = file;
  state.avatarModelObjectUrl = URL.createObjectURL(file);
}

async function modelDataUrl(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return `data:model/gltf-binary;base64,${btoa(binary)}`;
}

async function saveAvatarModel(agentId, modelData, approved = false) {
  try { return await api(`/api/agents/${agentId}/avatar-model`, { method: 'POST', body: JSON.stringify({ modelData, approved }) }); }
  catch (error) {
    if (!error.body?.approvalRequired) throw error;
    const accepted = await userConfirm('Save this 3D avatar?', 'The GLB model will be validated and stored only in HexiGrid’s local data folder.', 'Save 3D avatar');
    if (!accepted) throw new Error('3D avatar upload cancelled.');
    return saveAvatarModel(agentId, modelData, true);
  }
}

async function resizeProfileImage(file) {
  if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Choose a PNG, JPEG, WebP, or animated GIF image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.readAsDataURL(file);
  });
  if ((file.type === 'image/gif' || file.type === 'image/webp') && file.size <= 1150 * 1024) return dataUrl;
  if (file.type === 'image/gif') throw new Error('Animated GIF profile pictures must be smaller than 1.15 MB.');
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("That image could not be opened."));
    element.src = dataUrl;
  });
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext("2d");
  context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
  return canvas.toDataURL("image/webp", 0.82);
}

async function saveAgent(event) {
  event.preventDefault();
  const payload = {
    name: $("#agentName").value, accountLabel: $("#accountLabel").value, transport: $("#transport").value,
    harness: $("#harness").value, ilandsAgentId: $("#ilandsAgentId").value, runnerHome: $("#runnerHome").value,
    workspacePath: $("#workspacePath").value, personality: $("#personality").value, instructions: $("#instructions").value,
    rules: $("#rules").value, model: $("#agentModel").value, useGlobalCommunication: $("#agentUseGlobalCommunication").checked,
    avatarImage: state.avatarDraft
  };
  try {
    let response = state.editingAgentId
      ? await api(`/api/agents/${state.editingAgentId}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await api("/api/agents", { method: "POST", body: JSON.stringify(payload) });
    if (state.avatarModelFile) response = await saveAvatarModel(response.agent.id, await modelDataUrl(state.avatarModelFile));
    else if (state.avatarModelRemove) response = await api(`/api/agents/${response.agent.id}/avatar-model`, { method: 'DELETE', body: JSON.stringify({ approved: true }) });
    const index = state.data.agents.findIndex((item) => item.id === response.agent.id);
    if (index >= 0) state.data.agents[index] = response.agent; else state.data.agents.push(response.agent);
    closeAgentModal(); renderAll(); notify(`${response.agent.name} saved locally.`);
  } catch (error) { notify(error.message, true); }
}

async function duplicateAgent(agentId) {
  try {
    const response = await api(`/api/agents/${agentId}/duplicate`, { method: "POST" });
    state.data.agents.push(response.agent); renderAll();
    notify(`${response.agent.name} created. Give it a separate account home before connecting.`);
  } catch (error) { notify(error.message, true); }
}

async function deleteAgent() {
  if (!state.editingAgentId) return;
  const item = agent(state.editingAgentId);
  if (!await userConfirm(`Remove ${item.name}?`, "This removes the local profile from rooms. Connected service credentials are managed separately.", "Remove agent", true)) return;
  try {
    await api(`/api/agents/${item.id}`, { method: "DELETE" });
    state.data.agents = state.data.agents.filter((candidate) => candidate.id !== item.id);
    state.data.rooms.forEach((room) => { room.agentIds = room.agentIds.filter((candidate) => candidate !== item.id); });
    closeAgentModal(); renderAll(); notify(`${item.name} removed.`);
  } catch (error) { notify(error.message, true); }
}
