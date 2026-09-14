/* One-to-one and multi-agent local room conversations. */
function renderRooms() {
  $("#roomList").innerHTML = state.data.rooms.map((room) => `<button class="room-item ${room.id === state.activeRoomId ? "active" : ""}" data-action="select-room" data-room-id="${room.id}"><strong>${escapeHtml(room.name)}</strong><small>${room.agentIds.length} responder${room.agentIds.length === 1 ? "" : "s"}</small></button>`).join("");
  const room = activeRoom();
  const input = $("#chatInput");
  const send = $("#chatForm button[type='submit']");
  const rename = document.querySelector(".chat-head [data-action='rename-room']");
  if (!room) {
    $("#roomTitle").textContent = "No chat room yet";
    $("#roomDescription").textContent = "Create a room after you add an agent.";
    $("#participantChips").innerHTML = '<span class="filter-note">No participants yet.</span>';
    $("#messageList").innerHTML = '<div class="empty-state"><strong>Your chats will appear here</strong><p>Choose + beside Rooms when you are ready to start one.</p></div>';
    $("#composerHint").textContent = "Create a room first.";
    input.disabled = true;
    send.disabled = true;
    rename.disabled = true;
    return;
  }
  input.disabled = false;
  send.disabled = false;
  rename.disabled = false;
  $("#roomTitle").textContent = room.name;
  $("#roomDescription").textContent = room.description ? `${room.description} · local HexiGrid chat` : "Local HexiGrid chat · not an iLands inbox";
  $("#participantChips").innerHTML = state.data.agents.map((item) => `<label class="participant-chip ${room.agentIds.includes(item.id) ? "selected" : ""}"><input type="checkbox" data-agent-toggle="${item.id}" ${room.agentIds.includes(item.id) ? "checked" : ""} />${colorTile(item.color, "agent-color-dot")}${escapeHtml(item.name)}</label>`).join("") || `<span class="filter-note">Add an agent first.</span>`;
  $("#composerHint").textContent = room.agentIds.length ? `${room.agentIds.length} selected · this room stays in HexiGrid` : "Select at least one agent.";
  $("#messageList").innerHTML = room.messages.map((message) => {
    const participant = message.agentId ? agent(message.agentId) : null;
    const avatarColor = participant ? colorTile(participant.color) : "";
    const delivery = message.role === 'agent' && message.delivery === 'local-only' ? ' · LOCAL CHAT' : '';
    return `<div class="message ${message.role}"><div class="message-avatar">${avatarColor}<span class="avatar-initials">${message.role === "user" ? "T6" : escapeHtml(initials(message.author || "SH"))}</span></div><div class="message-body"><div class="message-meta">${escapeHtml(message.author || "System")} · ${timeAgo(message.createdAt)}${delivery}</div><div class="message-content">${escapeHtml(message.content)}</div></div></div>`;
  }).join("") || `<div class="empty-state">No messages yet. Start the room.</div>`;
  const list = $("#messageList");
  list.scrollTop = list.scrollHeight;
}

async function updateRoomAgents() {
  const room = activeRoom();
  if (!room) return;
  const selected = $$("[data-agent-toggle]:checked").map((input) => input.dataset.agentToggle);
  try {
    const response = await api(`/api/rooms/${room.id}`, { method: "PATCH", body: JSON.stringify({ agentIds: selected }) });
    Object.assign(room, response.room); renderRooms();
  } catch (error) { notify(error.message, true); }
}

async function sendChat(event) {
  event.preventDefault();
  const room = activeRoom();
  const input = $("#chatInput");
  const content = input.value.trim();
  if (!content) return;
  if (!room) return notify("Create a chat room first.", true);
  if (!room.agentIds.length) return notify("Select at least one agent first.", true);
  input.value = ""; input.disabled = true; $("#composerHint").textContent = "The selected agents are responding…";
  try {
    let response = await api(`/api/rooms/${room.id}/messages/user`, { method: "POST", body: JSON.stringify({ content, agentIds: room.agentIds }) });
    Object.assign(room, response.room); renderAll();
    const participants = room.agentIds.map((agentId) => agent(agentId)).filter(Boolean);
    for (const participant of participants) {
      const model = modelInfo(participant.model);
      if (model?.browser) {
        try {
          const generated = await window.HexiGridBrowserChat.completeTurn({
            agent: participant,
            room,
            settings: state.data.settings,
            memories: state.data.memories,
            modelId: model.remoteModel
          });
          response = await api(`/api/rooms/${room.id}/messages/browser`, { method: "POST", body: JSON.stringify({ agentId: participant.id, content: generated.content, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, inputText: content, outputText: generated.content }) });
        } catch (error) {
          response = await api(`/api/rooms/${room.id}/messages/browser`, { method: "POST", body: JSON.stringify({ agentId: participant.id, error: error.message }) });
        }
      } else {
        response = await api(`/api/rooms/${room.id}/messages`, { method: "POST", body: JSON.stringify({ agentIds: [participant.id], includeUserMessage: false }) });
      }
      Object.assign(room, response.room);
      renderAll();
    }
  } catch (error) { notify(error.message, true); input.value = content; }
  finally { input.disabled = false; input.focus(); renderRooms(); }
}

async function newRoom() {
  const name = await userInput("Create a chat room", "Room name", `Room ${state.data.rooms.length + 1}`);
  if (!name?.trim()) return;
  try {
    const response = await api("/api/rooms", { method: "POST", body: JSON.stringify({ name }) });
    state.data.rooms.push(response.room); state.activeRoomId = response.room.id; renderAll(); showView("room"); notify(`${response.room.name} created.`);
  } catch (error) { notify(error.message, true); }
}

async function renameRoom() {
  const room = activeRoom();
  if (!room) return;
  const name = await userInput("Rename this room", "Room name", room.name);
  if (!name?.trim()) return;
  try {
    const response = await api(`/api/rooms/${room.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    Object.assign(room, response.room); renderAll(); notify("Room updated.");
  } catch (error) { notify(error.message, true); }
}
