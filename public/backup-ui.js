function renderSecurity() {
  const root = document.querySelector('#securityTools');
  if (!root || !state.data) return;
  const auth = state.data.settings.auth || {};
  const browser = isStandaloneBrowser();
  root.innerHTML = `<div class="eyebrow">SECURITY + RECOVERY</div><h3>Protect and move your local data</h3><p class="panel-copy">Encrypted backups include chats, profiles, settings, and history. ${browser ? 'Provider keys are encrypted in this browser vault but excluded from downloaded backups, so enter them again after a restore on another device.' : 'Provider API keys stay in the operating system vault and must be entered again on another device.'}</p><div class="security-status"><span class="status-badge ${auth.localPasscode ? '' : 'warn'}">${auth.localPasscode ? 'PASSCODE ON' : 'GOOGLE SIGN-IN'}</span><span>${browser ? 'Your passcode unlocks AES-256 encryption; the usable key exists only in this tab while it is unlocked.' : auth.localPasscode ? 'Local sessions expire after 12 hours.' : 'Add a local passcode if you also want offline sign-in.'}</span></div><div class="provider-actions">${!browser && !auth.localPasscode ? '<button class="secondary-button" data-control-action="add-local-passcode">Add local passcode</button>' : ''}<button class="secondary-button" data-control-action="export-backup">Download encrypted backup</button><button class="secondary-button" data-control-action="import-backup">Restore encrypted backup</button><button class="ghost-button" data-control-action="logout">Lock now</button></div><input id="backupFile" type="file" accept="application/json,.json" hidden>`;
}

async function makeBackup() {
  const answer = window.hexigridModal ? await window.hexigridModal({ title: 'Encrypt a local backup', message: 'Use at least 12 characters. You need this passphrase to restore the file.', accept: 'Create backup', fields: [{ label: 'Backup passphrase', type: 'password', required: true }] }) : null;
  const passphrase = answer?.[0];
  if (!passphrase) return;
  try {
    const result = await api('/api/backup/export', { method: 'POST', body: JSON.stringify({ passphrase }) });
    const blob = new Blob([JSON.stringify(result.envelope, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(link.href);
    notify('Encrypted backup downloaded.');
  } catch (error) { notify(error.message, true); }
}

document.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-control-action]')?.dataset.controlAction;
  if (action === 'add-local-passcode') return window.showAuthGate?.(true);
  if (action === 'export-backup') return makeBackup();
  if (action === 'logout') { await api('/api/auth/logout', { method: 'POST' }); location.reload(); }
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-control-action="import-backup"]');
  if (!button) return;
  event.stopImmediatePropagation();
  const input = document.querySelector('#backupFile');
  input.value = '';
  input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const envelope = JSON.parse(await file.text());
      const answer = await modalRequest({ title: 'Restore encrypted backup?', message: 'This replaces local control-room records on this device. Provider and tool keys remain device-specific.', accept: 'Restore backup', danger: true, fields: [{ label: 'Backup passphrase', type: 'password', required: true }] });
      if (!answer?.[0]) return;
      await approvedRequest('/api/backup/import', { method: 'POST', body: JSON.stringify({ envelope, passphrase: answer[0] }) }, 'Restore this encrypted backup and pause imported automation for review?');
      notify('Backup restored.');
      await refresh();
    } catch (error) { notify(error.message, true); }
  };
}, true);

document.addEventListener('click', async (event) => {
  if (!event.target.closest('[data-control-action="backup-rollback"]')) return;
  event.stopImmediatePropagation();
  const accepted = window.hexigridModal && await window.hexigridModal({ title: 'Roll back the last restore?', message: 'HexiGrid will restore the encrypted local state and private files that were present immediately before the last backup restore. Provider and tool secrets remain device-specific.', accept: 'Roll back restore', danger: true });
  if (!accepted) return;
  try { await approvedRequest('/api/backup/rollback', { method: 'POST', body: JSON.stringify({}) }, 'Roll back the last restore and replace the current local state?'); notify('The last restore was rolled back.'); await refresh(); }
  catch (error) { notify(error.message, true); }
}, true);
