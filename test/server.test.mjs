import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from 'node:http';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = 43919;
let processUnderTest;
let tempData;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/bootstrap`);
      if (response.ok) return;
    } catch { /* startup is still in progress */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not start.");
}

before(async () => {
  tempData = await mkdtemp(path.join(os.tmpdir(), "hexigrid-test-"));
  processUnderTest = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    windowsHide: true,
    env: { ...process.env, HEXIGRID_PORT: String(port), HEXIGRID_DATA_DIR: tempData, OPENCODE_CLI: "missing-opencode-for-test" },
    stdio: "ignore"
  });
  await waitForServer();
});

after(async () => {
  processUnderTest?.kill();
  const resolved = path.resolve(tempData);
  const tempRoot = path.resolve(os.tmpdir());
  const relative = path.relative(tempRoot, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Test cleanup must stay inside the OS temp directory.");
  await rm(resolved, { recursive: true, force: true });
});

test("local responses include browser security headers", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  const csp = response.headers.get("content-security-policy");
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /style-src 'self'/); assert.match(csp, /style-src-attr 'none'/); assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.equal(response.headers.get('strict-transport-security'), null, 'loopback HTTP must not advertise HSTS');
});

test('PWA raster assets are served with the correct type and cannot open arbitrary files', async () => {
  const icon = await fetch(`http://127.0.0.1:${port}/icon-maskable-512.png`);
  assert.equal(icon.status, 200); assert.equal(icon.headers.get('content-type'), 'image/png');
  assert.deepEqual([...new Uint8Array((await icon.arrayBuffer()).slice(0, 8))], [137,80,78,71,13,10,26,10]);
  assert.equal((await fetch(`http://127.0.0.1:${port}/splash-../../server.png`)).status, 404);
  const browserRuntime = await fetch(`http://127.0.0.1:${port}/vendor/web-llm.js`);
  assert.equal(browserRuntime.status, 200);
  assert.match(browserRuntime.headers.get('content-type'), /javascript/);
  assert.ok((await browserRuntime.arrayBuffer()).byteLength > 1000000);
});

test('launcher identity endpoint and runtime record agree without exposing private state', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/system/identity`); const identity = await response.json();
  assert.deepEqual(Object.keys(identity).sort(), ['developmentFreshStart', 'instanceId', 'pid', 'port', 'product', 'scheme', 'version'].sort());
  assert.equal(identity.developmentFreshStart, false);
  assert.equal(identity.product, 'hexigrid'); assert.equal(identity.pid, processUnderTest.pid); assert.equal(identity.port, port);
  const runtime = JSON.parse(await readFile(path.join(tempData, '.runtime.json'), 'utf8'));
  assert.equal(runtime.instanceId, identity.instanceId); assert.equal(runtime.pid, identity.pid); assert.equal(runtime.port, identity.port); assert.equal(runtime.product, 'hexigrid');
});

test("a new control room starts without fake agent profiles", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/bootstrap`);
  const body = await response.json();
  assert.deepEqual(body.agents, []);
  assert.deepEqual(body.usage, []);
  assert.deepEqual(body.rooms, []);
  assert.deepEqual(body.activity, []);
  assert.deepEqual(body.receipts, []);
  assert.deepEqual(body.tasks, []);
});

test("mutations from a foreign browser origin are rejected", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/settings`, {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "https://example.com" },
    body: JSON.stringify({ workMode: "build" })
  });
  assert.equal(response.status, 403);
});

test("workspace paths cannot escape the private root", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/workspace/file?path=../../server.mjs`);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /outside the HexiGrid workspace/);
});

test("Converse mode denies workspace writes", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/workspace/file`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "/blocked.txt", content: "no" })
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).denied, true);
});

test("oversized request bodies are rejected", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/settings`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(2 * 1024 * 1024 + 1) })
  });
  assert.equal(response.status, 413);
});

test('provider registration discovers current models when the user supplies only a key', async () => {
  const modelServer = http.createServer((req, res) => {
    assert.equal(req.url, '/v1/models');
    assert.equal(req.headers.authorization, 'Bearer discovery-key');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: [{ id: 'current-a' }, { id: 'current-b' }] }));
  });
  await new Promise(resolve => modelServer.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/providers`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Discovered local', baseUrl: `http://127.0.0.1:${modelServer.address().port}/v1`, models: '', apiStyle: 'openai-chat', apiKey: 'discovery-key' }) });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.deepEqual(body.provider.modelIds, ['current-a', 'current-b']);
    assert.doesNotMatch(JSON.stringify(body), /discovery-key/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/providers/${body.provider.id}`, { method: 'DELETE' })).status, 200);
  } finally { await new Promise(resolve => modelServer.close(resolve)); }
});

test('provider registration routes a room reply and records exact metering',async()=>{
  const providerServer=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    assert.equal(req.url,'/v1/chat/completions');
    assert.equal(JSON.parse(body).model,'test-model');
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({choices:[{message:{content:'Integration reply'}}],usage:{prompt_tokens:32,completion_tokens:4}}));
  });
  await new Promise(resolve=>providerServer.listen(0,'127.0.0.1',resolve));
  const request=async(url,method,body)=>{const response=await fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,...await response.json()};};
  try{
    const {provider,status}=await request('/api/providers','POST',{name:'Integration local',baseUrl:`http://127.0.0.1:${providerServer.address().port}/v1`,models:'test-model'});
    assert.equal(status,201);
    const model=`provider:${provider.id}:test-model`;
    const {agent}=await request('/api/agents','POST',{name:'Integration agent',transport:'local-opencode',model});
    assert.equal(agent.model,model);
    const {room}=await request('/api/rooms','POST',{name:'Integration room'});
    const result=await request(`/api/rooms/${room.id}/messages`,'POST',{content:'Test',agentIds:[agent.id]});
    assert.equal(result.replies[0].content,'Integration reply');
    const bootstrap=await (await fetch(`http://127.0.0.1:${port}/api/bootstrap`)).json();
    const usage=bootstrap.usage.find(item=>item.agentId===agent.id);
    assert.equal(usage.inputTokens,32);assert.equal(usage.outputTokens,4);assert.equal(usage.estimated,false);
    assert.equal((await request(`/api/providers/${provider.id}`,'DELETE')).status,409);
    await request(`/api/agents/${agent.id}`,'DELETE');
    assert.equal((await request(`/api/providers/${provider.id}`,'DELETE')).status,200);
  }finally{await new Promise(resolve=>providerServer.close(resolve));}
});

test('browser inference connections route local replies without a server credential', async () => {
  const connection = await fetch(`http://127.0.0.1:${port}/api/on-device/providers`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test browser model', deviceId: 'browser-12345678', models: [{ id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi mini', lowResource: true }] })
  });
  assert.equal(connection.status, 201);
  const provider = (await connection.json()).provider;
  assert.equal(provider.kind, 'browser-webllm');
  assert.equal(provider.browser, true);
  assert.equal(provider.hasKey, false);
  assert.doesNotMatch(JSON.stringify(provider), /apiKey|secret|token/i);

  const model = `provider:${provider.id}:Phi-3.5-mini-instruct-q4f16_1-MLC`;
  const agentResponse = await fetch(`http://127.0.0.1:${port}/api/agents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Browser test agent', transport: 'local-opencode', model }) });
  assert.equal(agentResponse.status, 201);
  const agent = (await agentResponse.json()).agent;
  const roomResponse = await fetch(`http://127.0.0.1:${port}/api/rooms`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Browser test room' }) });
  const room = (await roomResponse.json()).room;
  const userResponse = await fetch(`http://127.0.0.1:${port}/api/rooms/${room.id}/messages/user`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'Say hello locally.', agentIds: [agent.id] }) });
  assert.equal(userResponse.status, 200);
  const browserResponse = await fetch(`http://127.0.0.1:${port}/api/rooms/${room.id}/messages/browser`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentId: agent.id, content: 'Hello from the browser model.', inputTokens: 11, outputTokens: 6 }) });
  assert.equal(browserResponse.status, 200);
  const browserBody = await browserResponse.json();
  assert.equal(browserBody.message.delivery, 'local-only');
  assert.equal(browserBody.message.transport, 'browser-webllm');
  assert.equal(browserBody.receipt.source, 'browser-webllm');
  const usage = (await (await fetch(`http://127.0.0.1:${port}/api/bootstrap`)).json()).usage.find((item) => item.agentId === agent.id && item.source === 'browser-webllm');
  assert.equal(usage.inputTokens, 11);
  assert.equal(usage.outputTokens, 6);
  assert.equal(usage.estimated, false);
  await fetch(`http://127.0.0.1:${port}/api/rooms/${room.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentIds: [] }) });
  const outsiderResponse = await fetch(`http://127.0.0.1:${port}/api/rooms/${room.id}/messages/browser`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentId: agent.id, content: 'Should be blocked after membership changes.' }) });
  assert.equal(outsiderResponse.status, 403);
  await fetch(`http://127.0.0.1:${port}/api/agents/${agent.id}`, { method: 'DELETE' });
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/providers/${provider.id}`, { method: 'DELETE' })).status, 200);
});

test('autonomous tasks are real persisted work items and respect the active mode', async () => {
  const createAgent = await fetch(`http://127.0.0.1:${port}/api/agents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Task agent', transport: 'local-opencode' }) });
  const agent = (await createAgent.json()).agent;
  const createTask = await fetch(`http://127.0.0.1:${port}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Bounded test', agentId: agent.id, prompt: 'Return one short status line.', maxRuns: 1 }) });
  assert.equal(createTask.status, 201);
  const task = (await createTask.json()).task;
  assert.equal(task.status, 'paused');
  const start = await fetch(`http://127.0.0.1:${port}/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'running' }) });
  assert.equal(start.status, 403);
  assert.equal((await start.json()).denied, true);
  await fetch(`http://127.0.0.1:${port}/api/agents/${agent.id}`, { method: 'DELETE' });
});

test('local authentication creates a session and protects private bootstrap data', async () => {
  const setup = await fetch(`http://127.0.0.1:${port}/api/auth/setup`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'local-test-passphrase' })
  });
  assert.equal(setup.status, 200);
  const cookie = setup.headers.get('set-cookie').split(';')[0];
  const locked = await fetch(`http://127.0.0.1:${port}/api/bootstrap`);
  assert.equal(locked.status, 401);
  assert.equal((await locked.json()).authRequired, true);
  const unlocked = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, { headers: { cookie } });
  assert.equal(unlocked.status, 200);
  assert.equal(unlocked.headers.get('content-type').includes('application/json'), true);

  const updated = await fetch(`http://127.0.0.1:${port}/api/settings`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ workMode: 'converse' })
  });
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.deepEqual(updatedBody.settings.auth, { configured: true, provider: 'local', googleLinked: false, localPasscode: true });
  for (const forbidden of ['hash', 'salt', 'recoveryHash', 'recoverySalt', 'googleSubject', 'googleEmail']) {
    assert.equal(JSON.stringify(updatedBody).includes(forbidden), false, `${forbidden} must never enter a settings response`);
  }
});
