function renderTasks() {
  const agents = state.data?.agents || [];
  const select = document.querySelector('#taskAgent');
  if (select) select.innerHTML = agents.map((agent) => `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)}</option>`).join('') || '<option value="">Add an agent first</option>';
  const root = document.querySelector('#taskList');
  if (!root) return;
  root.innerHTML = (state.data?.tasks || []).map((task) => {
    const target = agents.find((agent) => agent.id === task.agentId);
    const status = String(task.status || 'paused').replace('_', ' ');
    return `<article class="task-item"><div><strong>${escapeHtml(task.name)}</strong><small>${escapeHtml(target?.name || 'Missing agent')} · ${escapeHtml(status)}</small></div><p>${escapeHtml(task.lastError || task.lastOutput || task.prompt)}</p><div class="task-meta"><span>${task.runCount || 0}${task.maxRuns ? ` / ${task.maxRuns}` : ''} runs</span><span>${task.intervalSeconds ? `every ${task.intervalSeconds}s` : 'one run'}</span><span>${task.retryCount || 0} / ${task.maxRetries || 0} retries</span></div><div class="provider-actions"><button class="secondary-button" data-task-run="${task.id}" ${['completed', 'cancelled'].includes(task.status) ? 'disabled' : ''}>Run now</button><button class="secondary-button" data-task-toggle="${task.id}" data-task-status="${task.status === 'running' ? 'paused' : 'running'}">${task.status === 'running' ? 'Pause' : 'Start'}</button><button class="ghost-button" data-task-cancel="${task.id}" ${['completed', 'cancelled'].includes(task.status) ? 'disabled' : ''}>Stop</button></div></article>`;
  }).join('') || '<div class="empty-state">No autonomous tasks yet. Create one with a local agent and it will start paused.</div>';
}

async function taskRequest(id, action, extra) {
  try { await api(`/api/tasks/${id}/${action}`, { method: 'POST', body: JSON.stringify(extra || {}) }); await refresh(); }
  catch (error) {
    if (error.body?.approvalRequired && window.hexigridModal && await window.hexigridModal({ title: 'Approve task action?', message: error.message, accept: 'Approve once', danger: true })) return taskRequest(id, action, { ...(extra || {}), approved: true });
    notify(error.message, true);
  }
}

document.querySelector('#taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({ name: document.querySelector('#taskName').value, agentId: document.querySelector('#taskAgent').value, prompt: document.querySelector('#taskPrompt').value, intervalSeconds: Number(document.querySelector('#taskInterval').value), maxRuns: Number(document.querySelector('#taskMaxRuns').value), maxRetries: Number(document.querySelector('#taskMaxRetries').value) }) });
    document.querySelector('#taskFeedback').textContent = 'Created paused. Start it after choosing the right mode and approval level.';
    await refresh();
  } catch (error) { document.querySelector('#taskFeedback').textContent = error.message; }
});

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-control-action="refresh-tasks"],[data-task-run],[data-task-toggle],[data-task-cancel]');
  if (!target) return;
  if (target.dataset.controlAction === 'refresh-tasks') return refresh();
  if (target.dataset.taskRun) return taskRequest(target.dataset.taskRun, 'run');
  if (target.dataset.taskCancel) return taskRequest(target.dataset.taskCancel, 'cancel');
  if (!target.dataset.taskToggle) return;
  try {
    await api(`/api/tasks/${target.dataset.taskToggle}`, { method: 'PATCH', body: JSON.stringify({ status: target.dataset.taskStatus }) });
    await refresh();
  } catch (error) {
    if (error.body?.approvalRequired && window.hexigridModal && await window.hexigridModal({ title: 'Approve starting this task?', message: error.message, accept: 'Approve once', danger: true })) {
      await api(`/api/tasks/${target.dataset.taskToggle}`, { method: 'PATCH', body: JSON.stringify({ status: target.dataset.taskStatus, approved: true }) });
      await refresh();
    } else notify(error.message, true);
  }
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-control-action="emergency-stop"]');
  if (!button) return;
  event.stopImmediatePropagation();
  const accepted = window.hexigridModal && await window.hexigridModal({ title: 'Stop all autonomous work?', message: 'This pauses every running task and stops managed iLands Runner processes. Nothing is deleted; paused tasks can be started again later.', accept: 'Stop everything', danger: true });
  if (!accepted) return;
  try {
    const result = await api('/api/emergency/stop', { method: 'POST', body: JSON.stringify({}) });
    notify(`Emergency stop engaged: ${result.pausedTasks} task(s) paused, ${result.runnersStopped} Runner process(es) stopped.`);
    await refresh();
  } catch (error) { notify(error.message, true); }
}, true);
