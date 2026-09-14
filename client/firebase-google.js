import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';

const app = initializeApp({
  projectId: 'hexigrid',
  appId: '1:1007956777224:web:6873d26df76fd0d80b74bd',
  storageBucket: 'hexigrid.firebasestorage.app',
  apiKey: 'AIzaSyDUbKiGpE_RUBM-vF7gFgQsjYA19sJKH1Q',
  authDomain: 'hexigrid.firebaseapp.com',
  messagingSenderId: '1007956777224',
});

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.appdata');
provider.setCustomParameters({ prompt: 'select_account' });
let driveToken = '';

function account(result) {
  const credential = result ? GoogleAuthProvider.credentialFromResult(result) : null;
  if (credential?.accessToken) driveToken = credential.accessToken;
  const user = result?.user || auth.currentUser;
  return user ? { uid: user.uid, displayName: user.displayName || '', email: user.email || '', photoURL: user.photoURL || '' } : null;
}

async function prepare() {
  await setPersistence(auth, browserLocalPersistence);
  const result = await getRedirectResult(auth);
  return result ? account(result) : account(null);
}

async function connect({ force = false } = {}) {
  await setPersistence(auth, browserLocalPersistence);
  if (auth.currentUser && !force) return account(null);
  try {
    return account(await signInWithPopup(auth, provider));
  } catch (error) {
    if (!['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error?.code)) throw error;
    sessionStorage.setItem('hexigrid-google-redirect', '1');
    await signInWithRedirect(auth, provider);
    return null;
  }
}

async function idToken() {
  if (!auth.currentUser) return '';
  return auth.currentUser.getIdToken();
}

async function requireDriveToken() {
  if (driveToken) return driveToken;
  await connect({ force: true });
  if (!driveToken) throw new Error('Google Drive permission was not completed. Try Continue with Google again.');
  return driveToken;
}

async function driveRequest(url, options = {}) {
  const token = await requireDriveToken();
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) },
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) {
    if (response.status === 401) driveToken = '';
    throw new Error('Google Drive could not complete that backup action. Reconnect Google and try again.');
  }
  return response;
}

async function listBackups() {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: "name contains 'hexigrid-backup-' and trashed = false",
    orderBy: 'modifiedTime desc',
    pageSize: '10',
    fields: 'files(id,name,modifiedTime,size)',
  });
  return (await (await driveRequest(`https://www.googleapis.com/drive/v3/files?${params}`)).json()).files || [];
}

async function uploadBackup(envelope) {
  const boundary = `hexigrid-${crypto.randomUUID()}`;
  const name = `hexigrid-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const metadata = JSON.stringify({ name, mimeType: 'application/json', parents: ['appDataFolder'] });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(envelope)}\r\n--${boundary}--\r\n`;
  const created = await (await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size', { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body })).json();
  const history = await listBackups();
  await Promise.all(history.slice(10).map((file) => driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' }).catch(() => null)));
  return created;
}

async function downloadBackup(fileId) {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(String(fileId || ''))) throw new Error('That Google backup identifier is invalid.');
  return (await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`)).json();
}

window.HexiGridGoogle = Object.freeze({
  prepare,
  connect,
  idToken,
  current: () => account(null),
  onChange: (callback) => onAuthStateChanged(auth, () => callback(account(null))),
  disconnect: async () => { driveToken = ''; await signOut(auth); },
  listBackups,
  uploadBackup,
  downloadBackup,
});
