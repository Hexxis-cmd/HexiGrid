import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const read = (file) => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
const baseContext = (extra = {}) => vm.createContext({
  window: {}, crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, structuredClone,
  btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  atob: (value) => Buffer.from(value, 'base64').toString('binary'),
  URL, AbortSignal, location: { origin: 'https://hexigrid.example', protocol: 'https:' },
  navigator: { onLine: true }, console, ...extra
});

test('browser vault cryptography derives a non-exportable AES key and rejects a wrong passcode', async () => {
  const context = baseContext(); context.window = context;
  vm.runInContext(await read('browser-crypto.js'), context);
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await context.HexiGridBrowserCrypto.deriveKey('correct horse battery staple', salt);
  assert.equal(key.extractable, false);
  assert.equal(key.algorithm.name, 'AES-GCM');
  const envelope = await context.HexiGridBrowserCrypto.seal({ secret: 'never-readable-at-rest' }, key, { salt: context.HexiGridBrowserCrypto.bytesToBase64(salt) });
  assert.doesNotMatch(JSON.stringify(envelope), /never-readable-at-rest/);
  assert.equal(JSON.stringify(await context.HexiGridBrowserCrypto.open(envelope, key)), JSON.stringify({ secret: 'never-readable-at-rest' }));
  const wrong = await context.HexiGridBrowserCrypto.deriveKey('this is the wrong passcode', salt);
  await assert.rejects(() => context.HexiGridBrowserCrypto.open(envelope, wrong), /not correct|damaged/);
});

test('direct browser provider adapter discovers models and sends generation without Node or cookies', async () => {
  const requests = [];
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'live-model', pricing: { input: 0 } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ output_text: 'connected', usage: { input_tokens: 2, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const context = baseContext({ fetch, Response }); context.window = context;
  vm.runInContext(await read('browser-providers.js'), context);
  const provider = { baseUrl: 'https://provider.example/v1', apiStyle: 'openai-responses' };
  const discovery = await context.HexiGridBrowserProviders.discover(provider, 'browser-key');
  assert.equal(discovery.models[0].id, 'live-model');
  const answer = await context.HexiGridBrowserProviders.complete(provider, 'browser-key', 'live-model', [{ role: 'user', content: 'test' }]);
  assert.equal(answer.content, 'connected');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(requests[0].options.referrerPolicy, 'no-referrer');
  assert.equal(requests[0].options.headers.authorization, 'Bearer browser-key');
  assert.equal(requests[1].url, 'https://provider.example/v1/responses');
});

test('standalone runtime stores direct-provider state behind its vault and completes a room turn', async () => {
  let saved = null; let unlocked = false;
  const vault = {
    status: async () => ({ configured: Boolean(saved), unlocked }),
    setup: async (_passcode, initial) => { saved = structuredClone(initial); unlocked = true; },
    unlock: async () => { unlocked = true; return structuredClone(saved); },
    lock: () => { unlocked = false; },
    read: () => { if (!unlocked) throw new Error('Unlock this browser first.'); return structuredClone(saved); },
    write: async (next) => { saved = structuredClone(next); },
    replaceFromBackup: async (next) => { const previous = saved; saved = structuredClone(next); return previous; }
  };
  const providerApi = {
    cleanUrl: (value) => value.replace(/\/$/, ''),
    discover: async () => ({ models: [{ id: 'dynamic-model', label: 'Dynamic model' }], message: 'Direct browser connection succeeded.' }),
    complete: async () => ({ content: 'HexiGrid connected.', inputTokens: 4, outputTokens: 2 })
  };
  const context = baseContext(); context.window = context; context.HexiGridBrowserVault = vault; context.HexiGridBrowserProviders = providerApi;
  vm.runInContext(await read('standalone-runtime.js'), context);
  await context.HexiGridStandalone.request('/api/auth/setup', { method: 'POST', body: JSON.stringify({ password: 'long browser passcode' }) });
  const connected = await context.HexiGridStandalone.request('/api/providers', { method: 'POST', body: JSON.stringify({ name: 'Direct', baseUrl: 'https://provider.example/v1', apiStyle: 'openai-responses', apiKey: 'encrypted-key' }) });
  const createdAgent = await context.HexiGridStandalone.request('/api/agents', { method: 'POST', body: JSON.stringify({ name: 'Tester', model: `provider:${connected.provider.id}:dynamic-model` }) });
  const createdRoom = await context.HexiGridStandalone.request('/api/rooms', { method: 'POST', body: JSON.stringify({ name: 'Test' }) });
  await context.HexiGridStandalone.request(`/api/rooms/${createdRoom.room.id}`, { method: 'PATCH', body: JSON.stringify({ agentIds: [createdAgent.agent.id] }) });
  await context.HexiGridStandalone.request(`/api/rooms/${createdRoom.room.id}/messages/user`, { method: 'POST', body: JSON.stringify({ content: 'test', agentIds: [createdAgent.agent.id] }) });
  const result = await context.HexiGridStandalone.request(`/api/rooms/${createdRoom.room.id}/messages`, { method: 'POST', body: JSON.stringify({ agentIds: [createdAgent.agent.id], includeUserMessage: false }) });
  assert.equal(result.room.messages.at(-1).content, 'HexiGrid connected.');
  const bootstrap = await context.HexiGridStandalone.request('/api/bootstrap');
  assert.equal(bootstrap.security.localStateEncryption, 'browser-passcode-aes-256-gcm');
  assert.equal(bootstrap.providers[0].secret, undefined);
  assert.equal(bootstrap.providers[0].hasKey, true);
  assert.equal(bootstrap.receipts.at(0).detail.includes('direct browser HTTPS request'), true);
});

test('direct-browser failure is explicit and is the only point that offers fallback', async () => {
  const context = baseContext({ fetch: async () => { throw new TypeError('CORS'); } }); context.window = context;
  vm.runInContext(await read('browser-providers.js'), context);
  await assert.rejects(
    () => context.HexiGridBrowserProviders.discover({ baseUrl: 'https://blocked.example/v1', apiStyle: 'openai-chat' }, 'key'),
    (error) => error.code === 'DIRECT_BROWSER_UNAVAILABLE' && /user-owned relay|paired HexiGrid host/.test(error.message)
  );
});

test('standalone machine routes return live agents and dynamically discovered models', async () => {
  let saved = null; let unlocked = false;
  const vault = {
    status: async () => ({ configured: Boolean(saved), unlocked }),
    setup: async (_passcode, initial) => { saved = structuredClone(initial); unlocked = true; },
    unlock: async () => { unlocked = true; return structuredClone(saved); },
    lock: () => { unlocked = false; },
    read: () => structuredClone(saved),
    write: async (next) => { saved = structuredClone(next); },
    replaceFromBackup: async (next) => { saved = structuredClone(next); }
  };
  const context = baseContext(); context.window = context; context.HexiGridBrowserVault = vault;
  context.HexiGridBrowserProviders = { cleanUrl: (value) => value, discover: async () => ({ models: [{ id: 'current-model', label: 'Current model' }], message: 'Connected.' }) };
  vm.runInContext(await read('standalone-runtime.js'), context);
  await context.HexiGridStandalone.request('/api/auth/setup', { method: 'POST', body: JSON.stringify({ password: 'long browser passcode' }) });
  const connected = await context.HexiGridStandalone.request('/api/providers', { method: 'POST', body: JSON.stringify({ name: 'Current provider', baseUrl: 'https://provider.example/v1', apiKey: 'private' }) });
  await context.HexiGridStandalone.request('/api/agents', { method: 'POST', body: JSON.stringify({ name: 'Agent', model: `provider:${connected.provider.id}:current-model` }) });
  const agents = await context.HexiGridStandalone.request('/api/agents');
  const models = await context.HexiGridStandalone.request('/api/models');
  assert.equal(agents.agents.length, 1);
  assert.equal(models.models[0].label, 'Current model');
  assert.equal(JSON.stringify(models).includes('private'), false);
});

test('direct browser provider errors cannot reflect secrets or untrusted response text', async () => {
  const fetch = async () => new Response(JSON.stringify({ error: { message: 'reflected browser-key and hostile text' } }), { status: 500, headers: { 'content-type': 'application/json' } });
  const context = baseContext({ fetch, Response }); context.window = context;
  vm.runInContext(await read('browser-providers.js'), context);
  await assert.rejects(
    () => context.HexiGridBrowserProviders.discover({ baseUrl: 'https://provider.example/v1', apiStyle: 'openai-chat' }, 'browser-key'),
    (error) => !error.message.includes('browser-key') && !error.message.includes('hostile text') && /HTTP 500/.test(error.message)
  );
});
