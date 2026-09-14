/* Permission-aware local files and terminal. */
async function loadWorkspace(folder = state.workspaceFolder, openFirst = false) {
  try {
    const response = await api(`/api/workspace/tree?path=${encodeURIComponent(folder)}`);
    state.workspaceFolder = response.path;
    state.workspaceLoaded = true;
    $("#workspaceFolder").textContent = response.path;
    $("#workspaceFiles").innerHTML = response.entries.map((entry) => `<button class="file-item ${entry.type}" data-action="${entry.type === "directory" ? "open-workspace-folder" : "open-workspace-file"}" data-path="${escapeHtml(entry.path)}"><span data-icon="${entry.type === 'directory' ? 'folder' : 'file'}"></span><strong>${escapeHtml(entry.name)}</strong></button>`).join("") || `<div class="empty-state">This folder is empty.</div>`;
    if (openFirst) {
      const firstFile = response.entries.find((entry) => entry.type === "file");
      if (firstFile) await openWorkspaceFile(firstFile.path);
    }
  } catch (error) { notify(error.message, true); }
}

async function openWorkspaceFile(filePath) {
  try {
    const response = await api(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
    $("#workspacePathInput").value = response.path;
    $("#workspaceEditor").value = response.content;
  } catch (error) { notify(error.message, true); }
}

async function requestWorkspaceSave(approved = false) {
  return api("/api/workspace/file", { method: "PUT", body: JSON.stringify({ path: $("#workspacePathInput").value, content: $("#workspaceEditor").value, approved }) });
}

async function saveWorkspaceFile() {
  try {
    const response = await requestWorkspaceSave();
    notify(`${response.path} saved.`); await loadWorkspace(state.workspaceFolder);
  } catch (error) {
    if (error.body?.approvalRequired && await userConfirm("Approve this save?", error.message, "Approve once", true)) {
      try { const response = await requestWorkspaceSave(true); notify(`${response.path} saved.`); await loadWorkspace(state.workspaceFolder); }
      catch (approvedError) { notify(approvedError.message, true); }
    } else notify(error.message, true);
  }
}

async function runTerminal(event, approved = false, originalCommand = "") {
  event?.preventDefault();
  const input = $("#terminalInput");
  const command = originalCommand || input.value.trim();
  if (!command) return;
  input.value = "";
  const output = $("#terminalOutput");
  output.textContent += `\n\n› ${command}\n`;
  try {
    const response = await api("/api/workspace/command", { method: "POST", body: JSON.stringify({ command, approved }) });
    output.textContent += response.output;
    await loadWorkspace(state.workspaceFolder);
  } catch (error) {
    if (error.body?.approvalRequired && await userConfirm("Approve this command?", `${error.message}\n\n${command}`, "Approve once", true)) return runTerminal(null, true, command);
    output.textContent += error.body?.output || error.message;
  } finally { output.scrollTop = output.scrollHeight; input.focus(); }
}
