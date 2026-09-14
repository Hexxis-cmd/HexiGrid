function addControlNav(view, label, icon, after) {
  if (document.querySelector(`[data-view="${view}"]`)) return;
  const anchor = document.querySelector(`[data-view="${after}"]`);
  if (!anchor) return;
  const button = document.createElement('button');
  button.className = 'nav-item';
  button.dataset.view = view;
  button.innerHTML = `<span class="nav-icon" data-icon="${icon}"></span>${label}`;
  anchor.after(button);
}

addControlNav('tasks', 'Autonomous tasks', 'tasks', 'access');
addControlNav('plugins', 'Plugins & tools', 'plugin', 'tasks');

const taskRoot = document.createElement('section');
taskRoot.id = 'view-tasks';
taskRoot.className = 'view';
taskRoot.innerHTML = `<div class="page-intro"><div><div class="eyebrow">AUTONOMOUS WORK</div><h2>Bounded tasks</h2><p>Give an agent one repeatable outcome, choose its limits, then pause or stop it whenever you want.</p></div><span class="status-badge">LOCAL WORKER</span></div>
<div class="task-workbench"><form id="taskForm" class="panel stack-form"><div class="eyebrow">NEW TASK</div><h3>What should keep moving?</h3><label>Name<input id="taskName" maxlength="120" placeholder="Daily research check" required></label><label>Agent<select id="taskAgent" required></select></label><label>Instructions<textarea id="taskPrompt" rows="6" placeholder="Check the approved source, compare changes, and write a short note in the workspace." required></textarea></label><div class="form-grid two-col"><label>Repeat every seconds<input id="taskInterval" type="number" min="0" max="86400" value="0"></label><label>Maximum runs<input id="taskMaxRuns" type="number" min="1" max="10000" value="1"></label><label>Retries after failure<input id="taskMaxRetries" type="number" min="0" max="10" value="0"></label></div><p class="panel-copy">A value of 0 runs once. Retries use a bounded five-minute backoff. Tasks use the selected work mode and approval profile; Plan and Converse cannot execute them.</p><button class="primary-button" type="submit">Create paused task</button><p id="taskFeedback" role="status"></p></form><div class="panel"><div class="panel-heading"><div><div class="eyebrow">TASKS</div><h3>What is running</h3></div><button class="ghost-button" data-control-action="refresh-tasks">Refresh</button></div><div id="taskList"></div></div></div>`;
document.querySelector('.main-content').append(taskRoot);
taskRoot.querySelector('.page-intro').insertAdjacentHTML('beforeend', '<button class="danger-button secondary-button" data-control-action="emergency-stop">Emergency stop all</button>');

const pluginRoot = document.createElement('section');
pluginRoot.id = 'view-plugins';
pluginRoot.className = 'view';
pluginRoot.innerHTML = `<div class="page-intro"><div><div class="eyebrow">PLUGINS & TOOLS</div><h2>Extend the control room</h2><p>Install a verified package, review each exact capability, and enable it only when the access makes sense.</p></div><span class="status-badge">BROKERED SANDBOX</span></div>
<div class="plugin-workbench"><form id="pluginForm" class="panel stack-form"><div class="eyebrow">INSTALL VERSION 2 PACKAGE</div><h3>Add a local plugin</h3><p class="panel-copy">Choose plugin.json and all package files. Signed publishers are verified with Ed25519. Unsigned local packages require an explicit owner review.</p><input id="pluginFiles" type="file" multiple accept=".json,.js,.mjs" required><label class="toggle-row"><span><strong>I created or reviewed this unsigned package</strong><small>Leave off for a publisher-signed package. This never weakens its sandbox.</small></span><input id="pluginLocalTrust" type="checkbox"></label><button class="primary-button" type="submit">Verify, install, and review</button><p id="pluginFeedback" role="status"></p></form><div class="panel"><div class="panel-heading"><div><div class="eyebrow">INSTALLED</div><h3>Verified capabilities</h3></div><button class="ghost-button" data-control-action="refresh-plugins">Refresh</button></div><div id="pluginList"></div><div class="section-heading compact-heading"><div><div class="eyebrow">TRUSTED PUBLISHERS</div><h3>Signing keys</h3></div></div><div id="pluginPublisherList"></div></div></div>`;
document.querySelector('.main-content').append(pluginRoot);
document.querySelector('#pluginFiles').setAttribute('webkitdirectory', '');
document.querySelector('#pluginFiles').setAttribute('directory', '');
protectHostOnlyControls(document.querySelector('#pluginForm'), 'Install plugin bundles only on the computer running HexiGrid. Remote devices can review, enable, disable, and run already-installed capabilities within policy.');

const subagentPanel = [...document.querySelectorAll('#view-access .panel')].find((panel) => panel.querySelector('.eyebrow')?.textContent === 'SUBAGENTS');
if (subagentPanel && !subagentPanel.querySelector('#subagentsEnabled')) subagentPanel.insertAdjacentHTML('beforeend', '<label class="toggle-row"><span><strong>Allow subagents</strong><small>Agents may create focused helpers.</small></span><input id="subagentsEnabled" type="checkbox"></label><label class="range-row"><span>Maximum running at once</span><input id="subagentLimit" type="number" min="1" max="16" value="4"></label><button class="secondary-button full-button" data-action="save-subagents">Save subagent settings</button>');

const settingsGrid = document.querySelector('#view-settings .settings-grid');
const securityPanel = document.createElement('div');
securityPanel.id = 'securityTools';
securityPanel.className = 'panel security-tools';
settingsGrid.append(securityPanel);
const syncPanel = document.createElement('div');
syncPanel.id = 'syncTools';
syncPanel.className = 'panel security-tools';
settingsGrid.append(syncPanel);
