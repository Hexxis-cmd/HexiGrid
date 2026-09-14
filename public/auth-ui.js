let authSetupMode = false;
let currentAuthStatus = null;

function showAuthGate(setup) {
  authSetupMode = setup === undefined ? authSetupMode : setup;
  const gate = document.querySelector('#authGate');
  if (!gate) return;
  const browser = isStandaloneBrowser();
  const googleOnly = !authSetupMode && currentAuthStatus?.googleLinked && !currentAuthStatus?.localPasscode;
  document.querySelector('#onboarding')?.classList.add('hidden');
  gate.classList.remove('hidden');
  document.body.classList.add('overlay-open');
  document.querySelector('#authTitle').textContent = authSetupMode ? 'Create your local passcode' : 'Unlock this control room';
  document.querySelector('#authCopy').textContent = authSetupMode
    ? browser ? 'This passcode creates the encryption key for data and provider keys saved in this browser. It is never stored and there is no recovery backdoor.' : 'This passcode protects this HexiGrid workspace. It is never uploaded or shown to an agent.'
    : browser ? 'Enter the passcode for this browser workspace. No desktop or Node.js process is involved.' : 'Enter the passcode for this local workspace. Your data stays on the computer running HexiGrid.';
  document.querySelector('#authConfirmWrap').classList.toggle('hidden', !authSetupMode);
  document.querySelector('#authForm').classList.toggle('hidden', googleOnly);
  document.querySelector('#authSubmit').textContent = authSetupMode ? 'Protect this workspace' : 'Unlock';
  document.querySelector('#authSwitch').classList.toggle('hidden', googleOnly);
  document.querySelector('#authSwitch').textContent = authSetupMode ? 'I already have a passcode' : 'Create a local passcode instead';
  document.querySelector('#authPassword').autocomplete = authSetupMode ? 'new-password' : 'current-password';
}
window.showAuthGate = showAuthGate;

async function initAuth() {
  try {
    let status = await api('/api/auth/status');
    currentAuthStatus = status;
    document.querySelector('#authGoogle').classList.toggle('hidden', !window.HexiGridGoogle);
    document.querySelector('#authGoogle').textContent = 'Continue with Google';
    if (!status.configured) showAuthGate(true);
    else if (!status.authenticated) showAuthGate(false);
    window.hexigridAuthInitialized = true;

    await window.hexigridGoogleReady;
    status = await api('/api/auth/status');
    currentAuthStatus = status;
    if (status.authenticated) {
      document.querySelector('#authGate').classList.add('hidden');
      document.body.classList.remove('overlay-open');
      if (state.data) await refresh();
    }
  } catch (error) { notify(`Sign-in status unavailable: ${error.message}`, true); }
}

async function submitAuth(event) {
  event.preventDefault();
  const password = document.querySelector('#authPassword').value;
  const feedback = document.querySelector('#authFeedback');
  if (authSetupMode && password !== document.querySelector('#authPasswordConfirm').value) {
    feedback.textContent = 'The two passcodes do not match.';
    return;
  }
  try {
    const result = await api(authSetupMode ? '/api/auth/setup' : '/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
    document.querySelector('#authGate').classList.add('hidden');
    document.body.classList.remove('overlay-open');
    document.querySelector('#authPassword').value = '';
    document.querySelector('#authPasswordConfirm').value = '';
    if (result.recoveryCode && window.hexigridModal) await window.hexigridModal({ title: 'Save your recovery code', message: `Store this somewhere private. It is shown once and can reset the local passcode.\n\n${result.recoveryCode}`, accept: 'I saved it' });
    await refresh();
  } catch (error) { feedback.textContent = error.message; }
}

document.querySelector('#authForm').addEventListener('submit', submitAuth);
document.querySelector('#authSwitch').addEventListener('click', () => showAuthGate(!authSetupMode));
document.querySelector('#authGoogle').addEventListener('click', async () => {
  const feedback = document.querySelector('#authFeedback');
  try {
    const account = await window.connectHexiGridGoogle?.({ unlock: true });
    if (!account) return;
    if (isStandaloneBrowser()) {
      feedback.textContent = 'Google is connected. Create or enter your local encryption passcode to open this browser workspace.';
      return;
    }
    document.querySelector('#authGate').classList.add('hidden');
    document.body.classList.remove('overlay-open');
    await refresh();
  }
  catch (error) { feedback.textContent = error.message; }
});
window.hexigridAuthReady = initAuth();
