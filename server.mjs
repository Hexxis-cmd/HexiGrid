import http from "node:http";
import https from "node:https";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { APPROVAL_PROFILES, WORK_MODES, evaluatePolicy, publicPolicyCatalog } from "./lib/policy.mjs";
import { compileCommunicationPrompt, defaultCommunicationGuide, sanitizeCommunicationGuide } from "./lib/communication.mjs";
import { CredentialVault } from './lib/vault.mjs';
import { BRAND } from './lib/brand.mjs';
import { validateProvider, completeWithProvider, generateImageWithProvider, testProviderConnection } from './lib/providers.mjs';
import { encryptBackup, decryptBackup } from './lib/backup.mjs';
import { EncryptedStateStore } from './lib/local-state.mjs';
import { managedRunnerStatus, publicRunnerJob, resolveIlandsRunner, runnerProfileStatus, startManagedRunner, startRunnerJob, stopAllManagedRunners, stopAllRunnerJobs, stopManagedRunner, stopRunnerJob, supportedRunnerHarnesses } from './lib/ilands-runner.mjs';
import { executeOpenCode } from './lib/opencode-runtime.mjs';
import { parseOpenCodeModels } from './lib/opencode-models.mjs';
import { defaultHarnessModel, detectHarnesses, executeTextHarness, harnessCommand, publicHarnessConnection, runHarnessProcess } from './lib/harnesses.mjs';
import { callMcpTool, discoverMcpServer, validateMcpServer } from './lib/mcp-client.mjs';
import { collectPortableFiles, restorePortableFiles, rollbackPortableFiles } from './lib/portable-files.mjs';
import { buildPackageIdentity, installPluginPackage, publisherFingerprint, runPluginCapability, validatePluginManifest, validateSchemaValue, verifyInstalledPlugin, verifyPublisherSignature } from './lib/plugin-security.mjs';
import { createIlandsSetupPlan, fetchIlandsGuide, publicIlandsSetupPlan, verifyIlandsSetupPlan } from './lib/installer-security.mjs';
import { serveStaticAsset } from './lib/static-assets.mjs';
import { developmentResetEnabled, resetDevelopmentData } from './lib/development-reset.mjs';
import { ON_DEVICE_PROVIDER_KIND, createOnDeviceProvider, isOnDeviceProvider, sanitizeOnDeviceProvider } from './lib/on-device.mjs';
import { agentInterfaceManifest } from './lib/agent-interface.mjs';
import { verifyFirebaseIdToken } from './lib/firebase-auth.mjs';
import { publicLiveTranscript, sanitizeLiveTranscript, sanitizeVoiceProfile } from './lib/live-communication.mjs';
import { generateSpeechWithProvider } from './lib/speech-provider.mjs';
import { createRealtimeCall } from './lib/realtime-provider.mjs';
import { createCustomVoice } from './lib/custom-voice-provider.mjs';
import { validateAvatarModelData } from './lib/avatar-model.mjs';
import { QuickTunnel } from './lib/quick-tunnel.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_METADATA = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
if (PACKAGE_METADATA.name !== 'hexigrid' || !/^\d+\.\d+\.\d+$/.test(String(PACKAGE_METADATA.version || ''))) throw new Error('HexiGrid package metadata is invalid.');
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.HEXIGRID_DATA_DIR ? path.resolve(process.env.HEXIGRID_DATA_DIR) : process.env.AVENIQ_DATA_DIR ? path.resolve(process.env.AVENIQ_DATA_DIR) : path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "control-room.json");
const WORKSPACE_DIR = path.join(DATA_DIR, "workspace");
const PLUGIN_DIR = path.join(DATA_DIR, "plugins");
const RUNNER_PROFILE_DIR = path.join(DATA_DIR, 'runner-profiles');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const RUNTIME_FILE = path.join(DATA_DIR, '.runtime.json');
const INSTANCE_LOCK_FILE = path.join(DATA_DIR, '.instance.lock');
const credentialVault = new CredentialVault(path.join(DATA_DIR, 'vault'));
const stateStore = new EncryptedStateStore(DATA_FILE, credentialVault);
const PORT = Number(process.env.HEXIGRID_PORT || process.env.AVENIQ_PORT || 4318);
const NETWORK_REQUESTED = process.argv.includes("--network");
const HOST = process.env.HEXIGRID_HOST || process.env.AVENIQ_HOST || (NETWORK_REQUESTED ? "0.0.0.0" : "127.0.0.1");
const NETWORK_ENABLED = !isLoopbackHost(HOST);
const TLS_PFX_PATH = process.env.HEXIGRID_TLS_PFX ? path.resolve(process.env.HEXIGRID_TLS_PFX) : process.env.AVENIQ_TLS_PFX ? path.resolve(process.env.AVENIQ_TLS_PFX) : '';
const TLS_CERT_PATH = process.env.HEXIGRID_TLS_CERT ? path.resolve(process.env.HEXIGRID_TLS_CERT) : process.env.AVENIQ_TLS_CERT ? path.resolve(process.env.AVENIQ_TLS_CERT) : '';
const TLS_KEY_PATH = process.env.HEXIGRID_TLS_KEY ? path.resolve(process.env.HEXIGRID_TLS_KEY) : process.env.AVENIQ_TLS_KEY ? path.resolve(process.env.AVENIQ_TLS_KEY) : '';
const TLS_PASSPHRASE = process.env.HEXIGRID_TLS_PASSPHRASE || process.env.AVENIQ_TLS_PASSPHRASE || '';
const TLS_ENABLED = NETWORK_ENABLED;
const SERVER_SCHEME = TLS_ENABLED ? 'https' : 'http';
const MODEL = "";
const MAX_MESSAGES_PER_ROOM = 300;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_BACKUP_BODY_BYTES = 70 * 1024 * 1024;
const MAX_PLUGIN_BODY_BYTES = 14 * 1024 * 1024;
const configuredPairCode = process.env.HEXIGRID_PAIR_CODE || process.env.AVENIQ_PAIR_CODE || '';
const LAN_PAIR_CODE = /^[A-Fa-f0-9]{8,64}$/.test(configuredPairCode) ? configuredPairCode.toUpperCase() : crypto.randomBytes(4).toString("hex").toUpperCase();
const LAN_SESSION_TOKEN = process.env.HEXIGRID_ACCESS_TOKEN || process.env.AVENIQ_ACCESS_TOKEN || crypto.randomBytes(24).toString("base64url");
const AUTH_COOKIE = 'hexigrid_session';
const CSRF_COOKIE = 'hexigrid_csrf';
const sessions = new Map();
const sessionTtlMs = 12 * 60 * 60 * 1000;
const loginAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;
const pairingAttempts = new Map();
const pairingWindowMs = 5 * 60 * 1000;
const maxPairingAttempts = 8;
const pluginExecutions = new Map();
const ilandsSetupPlans = new Map();
const SERVER_INSTANCE_ID = crypto.randomUUID();
const APP_VERSION = PACKAGE_METADATA.version;
const quickTunnel = new QuickTunnel();
const DEVELOPMENT_FRESH_START = await developmentResetEnabled(DATA_DIR);
let startupReadOnly = false;
let startupVaultWarningShown = false;
process.on('unhandledRejection', (reason) => {
  console.error(`HexiGrid stopped after an unhandled asynchronous failure: ${reason instanceof Error ? reason.message : String(reason)}`);
  process.exitCode = 1;
});
process.on('uncaughtException', (error) => {
  console.error(`HexiGrid stopped after an uncaught failure: ${error?.message || String(error)}`);
  process.exit(1);
});

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

let modelCatalog = [];
let modelCatalogError = '';
let detectedHarnesses = [];

function defaultSettings() {
  return {
    brand: BRAND.name,
    model: MODEL,
    modelPolicy: "all-models",
    approvalPolicy: "review",
    workMode: "converse",
    activeGoal: { title: "", status: "idle", createdAt: null },
    subagents: { enabled: true, maxConcurrent: 4, inheritPolicy: true },
    communicationGuide: defaultCommunicationGuide(),
    owner: { displayName: "Owner", avatarImage: "" },
    sync: { enabled: false, provider: "google-drive", status: "not_configured", encrypted: true, lastSyncAt: null },
    auth: { configured: false, salt: "", hash: "", provider: "local" },
    plugins: { grants: {} },
    autoStart: false,
    setupAcknowledged: false
  };
}

function seedState() {
  return {
    version: 2,
    settings: defaultSettings(),
    agents: [],
    rooms: [],
    activity: [],
    usage: [],
    recovery: { lastRestoreAt: null },
    harnessConnections: [],
    runnerProfiles: [],
    pluginPublishers: [],
    receipts: [],
    liveTranscripts: []
  };
}

let state;
let writeQueue = Promise.resolve();

async function loadState() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  await fs.mkdir(PLUGIN_DIR, { recursive: true });
  await fs.mkdir(RUNNER_PROFILE_DIR, { recursive: true });
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const welcomeFile = path.join(WORKSPACE_DIR, "Welcome.md");
  if (!existsSync(welcomeFile)) {
    await fs.writeFile(welcomeFile, "# HexiGrid workspace\n\nFiles created here stay inside this local workspace. Agent actions will use the active mode and approval settings.\n", "utf8");
  }
  try {
    state = await stateStore.read();
  } catch (error) {
    if (error.code === 'STATE_KEY_UNAVAILABLE') { startupReadOnly = true; state = seedState(); }
    else {
      if (error.code !== 'ENOENT') throw new Error('The local state could not be read. It has been preserved; restore a valid backup before starting.');
      state = seedState();
      await saveState();
    }
  }
  const defaults = defaultSettings();
  state.settings = {
    ...defaults,
    ...(state.settings || {}),
    activeGoal: { ...defaults.activeGoal, ...(state.settings?.activeGoal || {}) },
    subagents: { ...defaults.subagents, ...(state.settings?.subagents || {}) },
    communicationGuide: {
      ...defaults.communicationGuide,
      ...(state.settings?.communicationGuide || {}),
      examples: Array.isArray(state.settings?.communicationGuide?.examples)
        ? state.settings.communicationGuide.examples
        : defaults.communicationGuide.examples
    },
    owner: { ...defaults.owner, ...(state.settings?.owner || {}) },
    sync: { ...defaults.sync, ...(state.settings?.sync || {}) },
    auth: { ...defaults.auth, ...(state.settings?.auth || {}) },
    plugins: { ...defaults.plugins, ...(state.settings?.plugins || {}) }
  };
  let migratedBrand = state.settings.brand !== BRAND.name;
  state.settings.brand = BRAND.name;
  state.agents ||= [];
  state.rooms ||= [];
  state.activity ||= [];
  for (const event of state.activity) {
    if (typeof event?.text === 'string' && /Aveniq/i.test(event.text)) {
      event.text = event.text.replace(/Aveniq/gi, BRAND.name);
      migratedBrand = true;
    }
  }
  for (const room of state.rooms) for (const message of room.messages || []) {
    if (message?.role === 'system' && typeof message.content === 'string' && /Aveniq/i.test(message.content)) {
      message.content = message.content.replace(/Aveniq/gi, BRAND.name);
      migratedBrand = true;
    }
  }
  state.usage ||= [];
  state.recovery ||= { lastRestoreAt: null };
  let migratedSecrets = false;
  if (Array.isArray(state.providers)) for (const provider of state.providers) {
    if (typeof provider?.apiKey === 'string' && provider.apiKey && provider.id) {
      try { await credentialVault.set(String(provider.id), provider.apiKey); migratedSecrets = true; }
      catch (error) { if (error?.code !== 'VAULT_UNAVAILABLE') throw error; }
    }
  }
  state.providers = Array.isArray(state.providers) ? state.providers.map(safeProviderRecord).filter(Boolean) : [];
  state.harnessConnections = Array.isArray(state.harnessConnections)
    ? state.harnessConnections.filter((item) => ['opencode', 'claude-code', 'codex'].includes(item?.id)).map((item) => ({ id: item.id, connectedAt: cleanString(item.connectedAt, now()).slice(0, 40), enabled: item.enabled !== false }))
    : [];
  state.tasks ||= [];
  state.taskRuns ||= [];
  state.runnerProfiles ||= [];
  state.receipts ||= [];
  state.liveTranscripts = Array.isArray(state.liveTranscripts)
    ? state.liveTranscripts.map((item) => ({ id: cleanString(item?.id, id('transcript')), ...sanitizeLiveTranscript(item) })).slice(0, 100)
    : [];
  if (Array.isArray(state.mcpServers)) for (const server of state.mcpServers) {
    if (server?.secrets && typeof server.secrets === 'object' && server.id) {
      try { await credentialVault.set(`mcp-${server.id}`, JSON.stringify(server.secrets)); migratedSecrets = true; }
      catch (error) { if (error?.code !== 'VAULT_UNAVAILABLE') throw error; }
    }
  }
  state.mcpServers = Array.isArray(state.mcpServers) ? state.mcpServers.map(safeMcpRecord) : [];
  state.media ||= [];
  state.memories ||= [];
  state.taskRuns = state.taskRuns.map((run) => run.status === 'running' ? { ...run, status: 'interrupted', error: 'HexiGrid stopped before this run finished.', finishedAt: now() } : run);
  state.tasks = state.tasks.map((task) => task.status === 'running' ? { ...task, nextRunAt: now(), lastError: 'Resuming after HexiGrid restarted.' } : task);
  state.runnerProfiles = state.runnerProfiles.filter((profile) => /^[a-z0-9-]{3,80}$/.test(String(profile.id || ''))).map((profile) => ({ ...profile, home: path.join(RUNNER_PROFILE_DIR, profile.id) }));
  state.plugins = Array.isArray(state.plugins) ? state.plugins.map(safePluginRecord).filter(Boolean) : [];
  state.pluginPublishers = Array.isArray(state.pluginPublishers) ? state.pluginPublishers.filter((item) => /^[a-z0-9][a-z0-9-]{1,48}$/.test(String(item?.id || ''))).map((item) => ({ id: item.id, name: cleanString(item.name, item.id).slice(0, 100), fingerprint: /^[a-f0-9]{64}$/.test(String(item.fingerprint || '')) ? item.fingerprint : '', trusted: false })) : [];
  for (const plugin of state.plugins.filter((item) => item.publisher && item.publisherFingerprint)) {
    if (!state.pluginPublishers.some((item) => item.id === plugin.publisher.id)) state.pluginPublishers.push({ id: plugin.publisher.id, name: plugin.publisher.name, fingerprint: plugin.publisherFingerprint, trusted: false });
  }
  for (const plugin of state.plugins) {
    if (plugin.quarantined) continue;
    const verified = await verifyInstalledPlugin(plugin, PLUGIN_DIR);
    if (!verified.ok) quarantinePlugin(plugin, verified.error);
  }
  await refreshPluginCredentialStatus();
  state.agents = state.agents.map((agent) => ({
    model: state.settings.model || MODEL,
    useGlobalCommunication: true,
    avatarImage: "",
    ...agent,
    voiceProfile: sanitizeVoiceProfile(agent.voiceProfile)
  }));
  if ((state.version || 1) < 2) {
    const placeholders = new Set(["agent-1", "agent-2", "agent-3"]);
    const isPlaceholder = (agent) => placeholders.has(agent.id) && /^Agent [123]$/.test(agent.name) && !agent.ilandsAgentId && !agent.personality && !agent.instructions && !agent.rules && !agent.avatarImage;
    const removedIds = new Set(state.agents.filter(isPlaceholder).map((agent) => agent.id));
    state.agents = state.agents.filter((agent) => !removedIds.has(agent.id));
    for (const room of state.rooms || []) room.agentIds = (room.agentIds || []).filter((agentId) => !removedIds.has(agentId));
    state.version = 2;
    if (removedIds.size) addActivity("system", "Removed starter agent placeholders. Connected accounts now appear only after setup.");
    await saveState();
  }
  if (state.settings.sync.provider === "firebase") state.settings.sync.provider = "google-drive";
  delete state.settings.sync['google' + 'ClientId'];
  if (stateStore.loadedPlaintext || migratedSecrets || migratedBrand) {
    try { await saveState(); }
    catch (error) {
      if (error?.code !== 'VAULT_UNAVAILABLE') throw error;
      startupReadOnly = true;
    }
  }
}

function saveState() {
  if (startupReadOnly) {
    const error = new Error('Local state is read-only until the operating-system credential vault is available again.');
    error.code = 'VAULT_UNAVAILABLE'; error.status = 503; return Promise.reject(error);
  }
  const snapshot = structuredClone(state);
  writeQueue = writeQueue.catch(()=>{}).then(() => stateStore.write(snapshot));
  return writeQueue;
}

function addActivity(kind, text) {
  state.activity.unshift({ id: id("event"), kind, text, createdAt: now() });
  state.activity = state.activity.slice(0, 80);
}

function addReceipt({ agentId = null, action, capability, risk, status, detail = '', source = 'hexigrid' }) {
  const receipt = { id: id('receipt'), agentId, action, capability, risk, status, detail: cleanString(detail).slice(0, 1000), source, createdAt: now() };
  state.receipts.unshift(receipt);
  state.receipts = state.receipts.slice(0, 10000);
  return receipt;
}

function safeProviderRecord(provider) {
  const { apiKey, key, secret, token, ...safe } = provider || {};
  if (isOnDeviceProvider(safe)) {
    try { return sanitizeOnDeviceProvider({ ...safe, hasKey: false }); }
    catch { return { id: /^[a-zA-Z0-9-]{2,120}$/.test(String(safe.id || '')) ? safe.id : `provider-invalid-${crypto.randomUUID().slice(0, 8)}`, name: cleanString(safe.name, 'Unavailable on-device models').slice(0, 80), kind: ON_DEVICE_PROVIDER_KIND, baseUrl: 'browser://webllm', modelIds: [], modelMeta: [], apiStyle: ON_DEVICE_PROVIDER_KIND, local: true, browser: true, enabled: false, capabilities: ['chat'], hasKey: false, invalid: true, lastError: 'This on-device model record is invalid. Refresh the supported models and add it again.' }; }
  }
  const modelIds = Array.isArray(safe.modelIds) ? safe.modelIds.join('\n') : safe.models;
  try {
    const normalized = validateProvider({ name: safe.name, baseUrl: safe.baseUrl, models: modelIds, apiStyle: safe.apiStyle });
    const providerId = /^[a-zA-Z0-9-]{2,120}$/.test(String(safe.id || '')) ? safe.id : `provider-${crypto.randomUUID().slice(0, 8)}`;
    return {
      id: providerId,
      ...normalized,
      capabilities: Array.isArray(safe.capabilities) ? safe.capabilities.filter((item) => ['chat', 'image', 'speech', 'realtime'].includes(item)).slice(0, 4) : ['chat'],
      hasKey: provider?.hasKey === true,
      createdAt: typeof safe.createdAt === 'string' ? safe.createdAt.slice(0, 40) : undefined,
      lastCheckedAt: typeof safe.lastCheckedAt === 'string' ? safe.lastCheckedAt.slice(0, 40) : undefined,
      lastError: typeof safe.lastError === 'string' ? safe.lastError.slice(0, 800) : undefined
    };
  } catch {
    return { id: /^[a-zA-Z0-9-]{2,120}$/.test(String(safe.id || '')) ? safe.id : `provider-invalid-${crypto.randomUUID().slice(0, 8)}`, name: cleanString(safe.name, 'Unavailable provider').slice(0, 80), baseUrl: '', modelIds: [], apiStyle: 'openai-chat', local: false, enabled: false, capabilities: ['chat'], hasKey: false, invalid: true };
  }
}

function safeMcpRecord(server) {
  const { secrets, apiKey, key, token, ...safe } = server || {};
  const idValue = /^[a-zA-Z0-9-]{2,120}$/.test(String(safe.id || '')) ? safe.id : `mcp-invalid-${crypto.randomUUID().slice(0, 8)}`;
  try {
    const normalized = validateMcpServer(safe);
    return {
      id: idValue,
      ...normalized,
      ...(normalized.transport === 'stdio' && normalized.workspaceAccess !== 'none' ? { workspaceRoot: WORKSPACE_DIR } : {}),
      enabled: safe.enabled === true && /^[a-f0-9]{64}$/.test(String(safe.toolSetDigest || '')) && /^[a-f0-9]{64}$/.test(String(safe.serverIdentity || '')),
      tools: Array.isArray(safe.tools) ? safe.tools.slice(0, 128).filter((tool) => /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(String(tool?.name || '')) && /^[a-f0-9]{64}$/.test(String(tool?.digest || ''))).map((tool) => ({ name: String(tool.name), description: cleanString(tool.description).slice(0, 2000), inputSchema: tool.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : { type: 'object', properties: {}, additionalProperties: false }, digest: tool.digest })) : [],
      toolSetDigest: /^[a-f0-9]{64}$/.test(String(safe.toolSetDigest || '')) ? safe.toolSetDigest : '',
      serverIdentity: /^[a-f0-9]{64}$/.test(String(safe.serverIdentity || '')) ? safe.serverIdentity : '',
      executableDigest: /^[a-f0-9]{64}$/.test(String(safe.executableDigest || '')) ? safe.executableDigest : '',
      executablePath: typeof safe.executablePath === 'string' ? safe.executablePath.slice(0, 1000) : '',
      toolGrants: safe.toolGrants && typeof safe.toolGrants === 'object' ? Object.fromEntries(Object.entries(safe.toolGrants).filter(([name, grant]) => /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(name) && grant && ['read_local', 'network_read', 'write_workspace', 'run_tools', 'external_write', 'generate_media'].includes(grant.capability) && ['none', 'low', 'medium', 'high', 'critical'].includes(grant.risk)).map(([name, grant]) => [name, { capability: grant.capability, risk: grant.risk, approved: grant.approved === true, digest: /^[a-f0-9]{64}$/.test(String(grant.digest || '')) ? grant.digest : '' }])) : {},
      hasSecrets: server?.hasSecrets === true,
      createdAt: typeof safe.createdAt === 'string' ? safe.createdAt.slice(0, 40) : undefined,
      lastCheckedAt: typeof safe.lastCheckedAt === 'string' ? safe.lastCheckedAt.slice(0, 40) : undefined,
      lastError: typeof safe.lastError === 'string' ? safe.lastError.slice(0, 800) : undefined
    };
  } catch {
    return { id: idValue, name: cleanString(safe.name, 'Unavailable MCP server').slice(0, 100), transport: 'stdio', image: '', command: '', args: [], workspaceAccess: 'none', local: true, enabled: false, tools: [], toolSetDigest: '', serverIdentity: '', executableDigest: '', executablePath: '', toolGrants: {}, hasSecrets: false, invalid: true, lastError: 'This saved host-process MCP record is disabled. Remove it and add a digest-pinned Podman image.' };
  }
}

function publicMcpRecord(server) {
  const { command, args, cwd, url, executablePath, workspaceRoot, ...record } = safeMcpRecord(server);
  return { ...record, connectionLocation: record.transport === 'http' ? (record.local ? 'this-device' : 'remote-https') : 'rootless-podman' };
}

function recordUsage({ agentId = null, model, inputText = "", outputText = "", source = "chat", inputTokens = null, outputTokens = null }) {
  state.usage.push({
    id: id("usage"), agentId, model: model || state.settings.model,
    inputTokens: inputTokens ?? Math.max(1, Math.ceil(String(inputText).length / 4)),
    outputTokens: outputTokens ?? Math.max(1, Math.ceil(String(outputText).length / 4)),
    source, estimated: inputTokens === null || outputTokens === null, createdAt: now()
  });
  state.usage = state.usage.slice(-10000);
}

function publicSettings() {
  const settings = JSON.parse(JSON.stringify(state.settings));
  settings.sync.configured = Boolean(state.settings.auth?.googleSubject);
  settings.auth = {
    configured: Boolean(state.settings.auth?.configured),
    provider: state.settings.auth?.provider || 'local',
    googleLinked: Boolean(state.settings.auth?.googleSubject),
    localPasscode: Boolean(state.settings.auth?.hash)
  };
  return settings;
}

function publicAgent(agent) {
  const model = state.media.find((item) => item.id === agent.avatarModelId && item.type === 'avatar-model');
  return { ...agent, avatarModel: model ? { id: model.id, size: model.size, url: `/api/media/${model.id}` } : null };
}

function publicState() {
  return {
    settings: publicSettings(),
    agents: state.agents.map(publicAgent),
    rooms: state.rooms,
    activity: state.activity,
    usage: state.usage,
    bridge: bridgeStatus(),
    policyCatalog: publicPolicyCatalog(),
    modelCatalog,
    harnesses: detectedHarnesses.map((item) => ({ ...item, connected: state.harnessConnections.some((connection) => connection.id === item.id && connection.enabled !== false) })),
    harnessConnections: state.harnessConnections.map(publicHarnessConnection),
    providers: (state.providers || []).map(safeProviderRecord),
    plugins: (state.plugins || []).map(safePluginRecord).filter(Boolean),
    pluginPublishers: state.pluginPublishers || [],
    tasks: state.tasks || [],
    taskRuns: state.taskRuns || [],
    runnerProfiles: (state.runnerProfiles || []).map((profile) => ({
      id: profile.id, label: profile.label, harness: profile.harness, agentId: profile.agentId || null,
      agentProfileId: profile.agentProfileId || null, createdAt: profile.createdAt,
      runtime: managedRunnerStatus(profile.id)
    })),
    receipts: (state.receipts || []).slice(0, 500),
    mcpServers: (state.mcpServers || []).map(publicMcpRecord),
    media: (state.media || []).slice(0, 500).map((item) => ({ ...item, url: `/api/media/${item.id}` })),
    memories: state.memories || [],
    liveTranscripts: (state.liveTranscripts || []).map(publicLiveTranscript),
    backupRecovery: { localRollbackAvailable: Boolean(state.recovery?.lastRestoreAt && existsSync(stateStore.previousFile)) },
    communicationDefaults: defaultCommunicationGuide(),
    security: {
      credentialVaultAvailable: credentialVault.isAvailable(),
      localStateEncryption: stateStore.degraded ? 'encrypted-local-key-fallback' : 'os-vault-key',
      secretFeaturesAvailable: credentialVault.isAvailable(),
      notice: credentialVault.isAvailable() ? '' : 'The OS credential vault is unavailable. Local control-room data remains encrypted, but API keys, OAuth credentials, plugin secrets, and MCP secrets are disabled until the vault is available.'
    }
  };
}

async function backupPayload() {
  const snapshot = JSON.parse(JSON.stringify(state));
  snapshot.providers = (snapshot.providers || []).map((provider) => ({ ...safeProviderRecord(provider), hasKey: false }));
  snapshot.mcpServers = (snapshot.mcpServers || []).map((server) => ({ ...safeMcpRecord(server), enabled: false, hasSecrets: false }));
  snapshot.plugins = (snapshot.plugins || []).map(safePluginRecord).filter(Boolean);
  snapshot.runnerProfiles = (snapshot.runnerProfiles || []).map((profile) => ({ ...profile, home: undefined }));
  snapshot.privateFiles = await collectPortableFiles({ workspace: WORKSPACE_DIR, media: MEDIA_DIR, plugins: PLUGIN_DIR });
  snapshot.backup = { format: 'hexigrid-local-data', version: 2, credentials: 'excluded-os-vault', createdAt: now() };
  return snapshot;
}

async function restoreState(payload, { restoreFiles = true, protectImported = true } = {}) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.agents) || !Array.isArray(payload.rooms)) throw new Error('The backup does not contain a valid control room.');
  const defaults = defaultSettings();
  const restored = {
    version: 2,
    settings: {
      ...defaults, ...(payload.settings || {}),
      activeGoal: { ...defaults.activeGoal, ...(payload.settings?.activeGoal || {}) },
      subagents: { ...defaults.subagents, ...(payload.settings?.subagents || {}) },
      communicationGuide: sanitizeCommunicationGuide(payload.settings?.communicationGuide),
      owner: { ...defaults.owner, ...(payload.settings?.owner || {}) },
      sync: { ...defaults.sync, ...(payload.settings?.sync || {}) },
      auth: { ...defaults.auth, ...(payload.settings?.auth || {}) },
      plugins: { ...defaults.plugins, ...(payload.settings?.plugins || {}) }
    },
    agents: payload.agents.slice(0, 1000),
    rooms: payload.rooms.slice(0, 1000),
    activity: Array.isArray(payload.activity) ? payload.activity.slice(0, 10000) : [],
    usage: Array.isArray(payload.usage) ? payload.usage.slice(-10000) : [],
    recovery: { lastRestoreAt: null },
    providers: Array.isArray(payload.providers) ? payload.providers.map((provider) => ({ ...safeProviderRecord(provider), hasKey: false })) : [],
    harnessConnections: Array.isArray(payload.harnessConnections) ? payload.harnessConnections.filter((item) => ['opencode', 'claude-code', 'codex'].includes(item?.id)).map((item) => ({ id: item.id, connectedAt: cleanString(item.connectedAt, now()).slice(0, 40), enabled: false })) : [],
    plugins: Array.isArray(payload.plugins) ? payload.plugins.map((plugin) => safePluginRecord({ ...plugin, enabled: protectImported ? false : plugin.enabled === true })).filter(Boolean) : [],
    pluginPublishers: Array.isArray(payload.pluginPublishers) ? payload.pluginPublishers.filter((item) => /^[a-z0-9][a-z0-9-]{1,48}$/.test(String(item?.id || ''))).map((item) => ({ id: item.id, name: cleanString(item.name, item.id).slice(0, 100), fingerprint: /^[a-f0-9]{64}$/.test(String(item.fingerprint || '')) ? item.fingerprint : '', trusted: false })) : [],
    tasks: Array.isArray(payload.tasks) ? payload.tasks.slice(0, 10000).map((task) => protectImported ? ({ ...task, status: 'paused', nextRunAt: null, retryCount: 0, lastError: 'Paused after restore. Review this task before starting it.', updatedAt: now() }) : ({ ...task, status: ['paused', 'running', 'waiting_approval', 'blocked', 'completed', 'cancelled', 'failed'].includes(task.status) ? task.status : 'paused' })) : [],
    taskRuns: Array.isArray(payload.taskRuns) ? payload.taskRuns.slice(-10000).map((run) => protectImported && run.status === 'running' ? { ...run, status: 'interrupted', error: 'The run was paused during backup restore.', finishedAt: now() } : run) : [],
    runnerProfiles: Array.isArray(payload.runnerProfiles) ? payload.runnerProfiles.filter((profile) => /^[a-z0-9-]{3,80}$/.test(String(profile.id || ''))).map((profile) => ({ ...profile, home: path.join(RUNNER_PROFILE_DIR, profile.id) })) : [],
    receipts: Array.isArray(payload.receipts) ? payload.receipts.slice(0, 10000) : [],
    liveTranscripts: Array.isArray(payload.liveTranscripts)
      ? payload.liveTranscripts.map((item) => ({ id: cleanString(item?.id, id('transcript')), ...sanitizeLiveTranscript(item) })).slice(0, 100)
      : [],
    mcpServers: Array.isArray(payload.mcpServers) ? payload.mcpServers.map((server) => ({ ...safeMcpRecord(server), enabled: false, hasSecrets: false })) : [],
    media: Array.isArray(payload.media) ? payload.media.slice(0, 500) : [],
    memories: Array.isArray(payload.memories) ? payload.memories.slice(0, 50000) : []
  };
  restored.settings.auth = { ...defaults.auth, ...(payload.settings?.auth || {}) };
  if (restoreFiles) await restorePortableFiles(payload.privateFiles, { workspace: WORKSPACE_DIR, media: MEDIA_DIR, plugins: PLUGIN_DIR });
  state = restored;
  await refreshPluginCredentialStatus();
}

function isLoopbackAddress(address = "") {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function isLoopbackHost(host = "") {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function isTunnelRequest(req) {
  return isLoopbackAddress(req.socket.remoteAddress) && quickTunnel.matchesRequest(req);
}

function isHostRequest(req) {
  return isLoopbackAddress(req.socket.remoteAddress) && !isTunnelRequest(req);
}

function lanAddresses() {
  const addresses = [];
  for (const group of Object.values(os.networkInterfaces())) {
    for (const item of group || []) {
      if (item.family === "IPv4" && !item.internal) addresses.push(item.address);
    }
  }
  return [...new Set(addresses)];
}

function cookieValue(req, name) {
  const cookie = req.headers.cookie || "";
  const match = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function csrfToken(req) { return cookieValue(req, CSRF_COOKIE); }
function secureCookieSuffix(req) { return req?.socket?.encrypted || isTunnelRequest(req) ? '; Secure' : ''; }

function csrfHeaders(req) {
  const existing = csrfToken(req) || crypto.randomBytes(24).toString('base64url');
  return { 'set-cookie': `${CSRF_COOKIE}=${encodeURIComponent(existing)}; SameSite=Strict; Path=/; Max-Age=43200${secureCookieSuffix(req)}` };
}

function csrfAllowed(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const fetchSite = String(req.headers['sec-fetch-site'] || '');
  if (!fetchSite && !req.headers.origin) return true;
  return safeEqual(csrfToken(req), String(req.headers['x-hexigrid-csrf'] || ''));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authStatus(req) {
  const configured = Boolean(state?.settings?.auth?.configured);
  const token = cookieValue(req, AUTH_COOKIE);
  const session = token ? sessions.get(token) : null;
  if (session && Date.now() - session.createdAt > sessionTtlMs) sessions.delete(token);
  const active = Boolean(session && Date.now() - session.createdAt <= sessionTtlMs);
  if (active) session.lastSeenAt = Date.now();
  const googleLinked = Boolean(state?.settings?.auth?.googleSubject);
  const localPasscode = Boolean(state?.settings?.auth?.hash);
  return { configured, authenticated: active, provider: state?.settings?.auth?.provider || 'local', googleAvailable: true, googleLinked, localPasscode, sessionId: active ? session.id : null };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (error, derived) => error ? reject(error) : resolve({ salt, hash: derived.toString('base64url') })));
}

async function verifyPassword(password, salt, expected) {
  const result = await hashPassword(password, salt);
  return safeEqual(result.hash, expected);
}

function sessionCookie(token, req) {
  const secure = secureCookieSuffix(req);
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}${secure}`;
}

function startSession(req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const timestamp = Date.now();
  sessions.set(token, {
    id: id('session'), createdAt: timestamp, lastSeenAt: timestamp,
    address: req.socket.remoteAddress || '',
    device: cleanString(req.headers['user-agent'], 'Unknown device').slice(0, 240)
  });
  return sessionCookie(token, req);
}

function startOrRefreshSession(req) {
  const token = cookieValue(req, AUTH_COOKIE);
  const session = token ? sessions.get(token) : null;
  if (!session || Date.now() - session.createdAt > sessionTtlMs) return startSession(req);
  session.lastSeenAt = Date.now();
  return sessionCookie(token, req);
}

function clearSession(req) {
  const token = cookieValue(req, AUTH_COOKIE);
  if (token) sessions.delete(token);
  return `${AUTH_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

function loginKey(req) { return isTunnelRequest(req) ? `tunnel:${req.headers['cf-connecting-ip']}` : req.socket.remoteAddress || 'unknown'; }

function loginLimit(req) {
  const key = loginKey(req);
  const record = loginAttempts.get(key);
  if (!record || Date.now() - record.startedAt >= loginWindowMs) {
    loginAttempts.delete(key);
    return { blocked: false, retryAfter: 0 };
  }
  return { blocked: record.count >= maxLoginAttempts, retryAfter: Math.max(1, Math.ceil((record.startedAt + loginWindowMs - Date.now()) / 1000)) };
}

function recordLoginFailure(req) {
  const key = loginKey(req);
  const existing = loginAttempts.get(key);
  if (!existing || Date.now() - existing.startedAt >= loginWindowMs) loginAttempts.set(key, { count: 1, startedAt: Date.now() });
  else existing.count += 1;
  return loginLimit(req);
}

function clearLoginFailures(req) { loginAttempts.delete(loginKey(req)); }

function pairingLimit(req) {
  const key = loginKey(req);
  const record = pairingAttempts.get(key);
  if (!record || Date.now() - record.startedAt >= pairingWindowMs) {
    pairingAttempts.delete(key);
    return { blocked: false, retryAfter: 0 };
  }
  return { blocked: record.count >= maxPairingAttempts, retryAfter: Math.max(1, Math.ceil((record.startedAt + pairingWindowMs - Date.now()) / 1000)) };
}

function recordPairingFailure(req) {
  const key = loginKey(req);
  const existing = pairingAttempts.get(key);
  if (!existing || Date.now() - existing.startedAt >= pairingWindowMs) pairingAttempts.set(key, { count: 1, startedAt: Date.now() });
  else existing.count += 1;
  return pairingLimit(req);
}

function publicSessions(req) {
  const currentToken = cookieValue(req, AUTH_COOKIE);
  const timestamp = Date.now();
  return [...sessions.entries()].filter(([, session]) => timestamp - session.createdAt <= sessionTtlMs).map(([token, session]) => ({
    id: session.id,
    current: token === currentToken,
    createdAt: new Date(session.createdAt).toISOString(),
    lastSeenAt: new Date(session.lastSeenAt).toISOString(),
    address: session.address,
    device: session.device
  }));
}

function authGate(req, res, url) {
  const pathName = url.pathname;
  if (pathName === '/api/auth/status' || pathName === '/api/auth/setup' || pathName === '/api/auth/login' || pathName === '/api/auth/recover' || pathName === '/api/auth/logout' || pathName === '/api/auth/google/firebase') return false;
  const status = authStatus(req);
  if (!status.configured || status.authenticated) return false;
  if (pathName.startsWith('/api/')) {
    json(res, 401, { error: 'Sign in to this local HexiGrid workspace.', authRequired: true });
    return true;
  }
  return false;
}

function pairingPage(res) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#070b11"><title>Pair with HexiGrid</title><link rel="stylesheet" href="/pairing.css"></head><body><main class="card"><h1>Pair this device</h1><p>Enter the one-time code shown in HexiGrid on your computer. The code resets whenever the local server restarts.</p><form method="get" action="/"><input name="pair" maxlength="8" autocomplete="one-time-code" required aria-label="Pairing code"><button>Connect securely</button></form><p>Only pair on a private network you trust.</p></main></body></html>`;
  res.writeHead(401, { ...securityHeaders("text/html; charset=utf-8"), "content-length": Buffer.byteLength(body) });
  res.end(body);
}

function networkGate(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/pairing.css') return false;
  if (isHostRequest(req)) return false;
  if (safeEqual(cookieValue(req, "hexigrid_lan"), LAN_SESSION_TOKEN)) return false;
  const pair = url.searchParams.get("pair") || "";
  const limit = pairingLimit(req);
  if (limit.blocked) {
    if (url.pathname.startsWith("/api/")) json(res, 429, { error: "Too many pairing attempts. Try again later.", retryAfter: limit.retryAfter }, { "retry-after": String(limit.retryAfter) });
    else pairingPage(res);
    return true;
  }
  if (safeEqual(pair.toUpperCase(), LAN_PAIR_CODE)) {
    pairingAttempts.delete(loginKey(req));
    res.writeHead(302, {
      ...securityHeaders("text/plain; charset=utf-8"),
      "set-cookie": `hexigrid_lan=${encodeURIComponent(LAN_SESSION_TOKEN)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secureCookieSuffix(req)}`,
      location: "/"
    });
    return res.end("Paired. Redirecting…"), true;
  }
  if (pair) recordPairingFailure(req);
  if (url.pathname.startsWith("/api/")) {
    json(res, 401, { error: "This device needs to be paired with HexiGrid." });
  } else pairingPage(res);
  return true;
}

function securityHeaders(contentType) {
  return {
    "content-type": contentType,
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; script-src 'self' https://apis.google.com; worker-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; connect-src 'self' https:; frame-src https://hexigrid.firebaseapp.com https://accounts.google.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "permissions-policy": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "cross-origin-resource-policy": "same-origin",
    ...(TLS_ENABLED ? { "strict-transport-security": "max-age=31536000" } : {})
  };
}

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...securityHeaders("application/json; charset=utf-8"),
    "content-length": Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

function html(res, file) {
  fs.readFile(path.join(PUBLIC_DIR, file)).then((body) => {
    res.writeHead(200, securityHeaders("text/html; charset=utf-8"));
    res.end(body);
  }).catch(() => json(res, 404, { error: "Not found" }));
}

async function readBody(req, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return {}; }
}

function mutationOriginAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.host === req.headers.host;
  } catch { return false; }
}

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 12000) : fallback;
}

function cleanImageData(value) {
  if (typeof value !== "string" || value.length > 1600000) return "";
  return /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value) ? value : "";
}

function cleanEmail(value) {
  const email = cleanString(value).toLowerCase().slice(0, 320);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function slug(value) {
  return cleanString(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function safeDataFilename(value) {
  const filename = String(value || '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,160}$/.test(filename)) throw new Error('A private file record has an unsafe name.');
  return filename;
}

function cleanMcpSecrets(value) {
  const blocked = new Set(['NODE_OPTIONS', 'NODE_PATH', 'PATH', 'Path', 'PATHEXT', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'COMSPEC', 'ComSpec', 'SHELL']);
  const entries = value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : [];
  return Object.fromEntries(entries.slice(0, 30).map(([key, secret]) => [String(key).replace(/[^A-Za-z0-9_]/g, '').slice(0, 80), String(secret).slice(0, 16000)]).filter(([key, secret]) => key && secret && !blocked.has(key.toUpperCase())));
}

function agentWorkspace(agentId) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,99}$/.test(String(agentId || ''))) throw new Error('This agent has an invalid local identity.');
  return path.join(WORKSPACE_DIR, 'agents', agentId);
}

function safePluginRecord(plugin) {
  try {
    const manifest = validatePluginManifest(plugin, { requirePackage: true });
    return {
      ...manifest,
      trust: plugin?.trust === 'signed-publisher' ? 'signed-publisher' : 'owner-local',
      publisherFingerprint: typeof plugin?.publisherFingerprint === 'string' ? plugin.publisherFingerprint.slice(0, 64) : null,
      installPath: cleanString(plugin?.installPath).replace(/\\/g, '/').slice(0, 140),
      enabled: plugin?.enabled === true && plugin?.quarantined !== true,
      quarantined: plugin?.quarantined === true,
      quarantineReason: cleanString(plugin?.quarantineReason).slice(0, 500),
      secretStatus: plugin?.secretStatus && typeof plugin.secretStatus === 'object' ? Object.fromEntries(Object.entries(plugin.secretStatus).map(([key, value]) => [key, value === true])) : {},
      installedAt: typeof plugin?.installedAt === 'string' ? plugin.installedAt.slice(0, 40) : undefined,
      lastRunAt: typeof plugin?.lastRunAt === 'string' ? plugin.lastRunAt.slice(0, 40) : null
    };
  } catch {
    const pluginId = /^[a-z0-9][a-z0-9-]{1,48}$/.test(String(plugin?.id || '')) ? plugin.id : null;
    if (!pluginId) return null;
    return {
      schemaVersion: Number(plugin?.schemaVersion) || 1,
      id: pluginId,
      name: cleanString(plugin?.name, pluginId).slice(0, 100),
      version: cleanString(plugin?.version, 'legacy').slice(0, 40),
      description: cleanString(plugin?.description).slice(0, 500),
      entry: '', capabilities: [], secrets: [], enabled: false, quarantined: true,
      quarantineReason: 'Legacy plugins are disabled. Reinstall this plugin using the version 2 package format.',
      secretStatus: {}, installedAt: plugin?.installedAt, lastRunAt: null
    };
  }
}

function pluginFolder(pluginId) {
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(pluginId)) throw new Error('Invalid plugin id.');
  return path.join(PLUGIN_DIR, pluginId);
}

function pluginPublisherVaultId(publisherId) {
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(String(publisherId || ''))) throw new Error('Invalid plugin publisher id.');
  return `plugin-publisher-${publisherId}`;
}

function pluginSecretVaultId(pluginId, secretId) {
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(String(pluginId || '')) || !/^[a-z0-9][a-z0-9-]{1,48}$/.test(String(secretId || ''))) throw new Error('Invalid plugin credential id.');
  return `plugin-${pluginId}-${secretId}`.slice(0, 90);
}

async function refreshPluginCredentialStatus() {
  for (const plugin of state.plugins || []) {
    plugin.secretStatus ||= {};
    for (const secret of plugin.secrets || []) plugin.secretStatus[secret.id] = Boolean(await credentialVault.get(pluginSecretVaultId(plugin.id, secret.id)));
  }
  for (const publisher of state.pluginPublishers || []) {
    const key = await credentialVault.get(pluginPublisherVaultId(publisher.id));
    try { publisher.trusted = Boolean(key && publisherFingerprint(key) === publisher.fingerprint); }
    catch { publisher.trusted = false; }
  }
}

function quarantinePlugin(plugin, reason) {
  plugin.enabled = false;
  plugin.quarantined = true;
  plugin.quarantineReason = cleanString(reason, 'Plugin integrity verification failed.').slice(0, 500);
}

async function verifyPluginForUse(plugin) {
  if (plugin.quarantined) return { ok: false, error: plugin.quarantineReason || 'This plugin is quarantined.' };
  const verified = await verifyInstalledPlugin(plugin, PLUGIN_DIR);
  if (!verified.ok) { quarantinePlugin(plugin, verified.error); return verified; }
  if (plugin.publisher) {
    const trustedKey = await credentialVault.get(pluginPublisherVaultId(plugin.publisher.id));
    if (!trustedKey || publisherFingerprint(trustedKey) !== plugin.publisherFingerprint) {
      quarantinePlugin(plugin, 'The publisher key is no longer trusted on this device.');
      return { ok: false, error: plugin.quarantineReason };
    }
  }
  return verified;
}

async function runInstalledPlugin(plugin, capability, input, signal, approved) {
  const active = pluginExecutions.get(plugin.id) || 0;
  if (active >= capability.limits.concurrency) throw new Error(`Plugin concurrency limit reached (${capability.limits.concurrency}).`);
  pluginExecutions.set(plugin.id, active + 1);
  try {
    return await runPluginCapability({
      plugin, capability, input, signal, pluginRoot: PLUGIN_DIR, workspaceRoot: WORKSPACE_DIR,
      runnerPath: path.join(ROOT, 'lib', 'plugin-runner.mjs'),
      secretResolver: (secretId) => credentialVault.get(pluginSecretVaultId(plugin.id, secretId)),
      authorize: ({ policyCapability, risk }) => {
        const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability: policyCapability, risk });
        if (policy.decision === 'deny') throw new Error(policy.reason);
        if (policy.decision === 'ask' && approved !== true) throw new Error(`Broker action requires approval: ${policy.reason}`);
      }
    });
  } finally {
    const remaining = (pluginExecutions.get(plugin.id) || 1) - 1;
    if (remaining > 0) pluginExecutions.set(plugin.id, remaining); else pluginExecutions.delete(plugin.id);
  }
}

function findAgent(agentId) {
  return state.agents.find((agent) => agent.id === agentId);
}

function findRoom(roomId) {
  return state.rooms.find((room) => room.id === roomId);
}

function safeWorkspacePath(relativePath = "") {
  const normalized = String(relativePath).replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(WORKSPACE_DIR, normalized);
  const relative = path.relative(WORKSPACE_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("That path is outside the HexiGrid workspace.");
  return resolved;
}

function relativeWorkspacePath(absolutePath) {
  const relative = path.relative(WORKSPACE_DIR, absolutePath).replace(/\\/g, "/");
  return relative ? `/${relative}` : "/";
}

async function workspaceEntries(relativePath = "") {
  const target = safeWorkspacePath(relativePath);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return entries.slice(0, 300).map((entry) => ({
    name: entry.name,
    path: relativeWorkspacePath(path.join(target, entry.name)),
    type: entry.isDirectory() ? "directory" : "file"
  })).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
}

function splitCommand(command) {
  return (String(command).match(/(?:[^\s"]+|"[^"]*")+/g) || []).map((part) => part.replace(/^"|"$/g, ""));
}

async function runWorkspaceCommand(rawCommand, approved = false) {
  const command = cleanString(rawCommand).slice(0, 4000);
  const [name = "", ...args] = splitCommand(command);
  const action = name.toLowerCase();
  const readActions = ["help", "pwd", "ls", "dir", "cat", "type"];
  const writeActions = ["mkdir", "touch", "write"];
  const destructiveActions = ["rm", "del"];
  if (!readActions.includes(action) && !writeActions.includes(action) && !destructiveActions.includes(action)) {
    return { ok: false, output: `Unknown command: ${name || "(empty)"}\nType help to see the commands available in this safe terminal.` };
  }

  const capability = readActions.includes(action) ? "read_local" : "write_workspace";
  const risk = destructiveActions.includes(action) ? "high" : readActions.includes(action) ? "low" : "medium";
  const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability, risk });
  if (policy.decision === "deny") return { ok: false, denied: true, output: policy.reason, policy };
  if (policy.decision === "ask" && !approved) return { ok: false, approvalRequired: true, output: policy.reason, policy };

  if (action === "help") return { ok: true, output: "help · pwd · ls [folder] · cat <file> · mkdir <folder> · touch <file> · write <file> <text> · rm <file>" };
  if (action === "pwd") return { ok: true, output: "/" };
  if (action === "ls" || action === "dir") {
    const entries = await workspaceEntries(args[0] || "");
    return { ok: true, output: entries.map((entry) => `${entry.type === "directory" ? "[folder]" : "[file]  "} ${entry.path}`).join("\n") || "This folder is empty." };
  }
  if (action === "cat" || action === "type") {
    if (!args[0]) return { ok: false, output: `Usage: ${action} <file>` };
    const content = await fs.readFile(safeWorkspacePath(args[0]), "utf8");
    return { ok: true, output: content.slice(0, 40000) };
  }
  if (action === "mkdir") {
    if (!args[0]) return { ok: false, output: "Usage: mkdir <folder>" };
    await fs.mkdir(safeWorkspacePath(args[0]), { recursive: true });
    return { ok: true, output: `Created ${relativeWorkspacePath(safeWorkspacePath(args[0]))}` };
  }
  if (action === "touch") {
    if (!args[0]) return { ok: false, output: "Usage: touch <file>" };
    const target = safeWorkspacePath(args[0]);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const handle = await fs.open(target, "a");
    await handle.close();
    return { ok: true, output: `Created ${relativeWorkspacePath(target)}` };
  }
  if (action === "write") {
    if (!args[0] || args.length < 2) return { ok: false, output: "Usage: write <file> <text>" };
    const target = safeWorkspacePath(args[0]);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, args.slice(1).join(" "), "utf8");
    return { ok: true, output: `Saved ${relativeWorkspacePath(target)}` };
  }
  if (!args[0]) return { ok: false, output: `Usage: ${action} <file>` };
  const target = safeWorkspacePath(args[0]);
  const stat = await fs.stat(target);
  if (stat.isDirectory()) return { ok: false, output: "This safe terminal removes files only. Delete folders from the file panel after reviewing their contents." };
  await fs.unlink(target);
  return { ok: true, output: `Removed ${relativeWorkspacePath(target)}` };
}

function resolveOpenCode() {
  const configured = process.env.OPENCODE_CLI;
  const candidates = [
    configured,
    process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "opencode.cmd") : null,
    process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "opencode.ps1") : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "opencode", "opencode.exe") : null
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === configured) return existsSync(candidate) ? commandForPath(candidate) : { command: candidate, args: [] };
    try {
      if (existsSync(candidate)) return commandForPath(candidate);
    } catch { /* continue */ }
  }
  return { command: process.platform === "win32" ? "opencode" : "opencode", args: [] };
}

function commandForPath(candidate) {
  if (process.platform === "win32" && candidate.toLowerCase().endsWith(".ps1")) {
    const shell = commandExists("pwsh.exe") ? "pwsh.exe" : "powershell.exe";
    return { command: shell, args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "RemoteSigned", "-File", candidate] };
  }
  if (process.platform === "win32" && candidate.toLowerCase().endsWith(".cmd")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", candidate] };
  }
  return { command: candidate, args: [] };
}

function commandExists(command) {
  const value = String(command || '');
  if (!value) return false;
  if (path.isAbsolute(value) || value.includes(path.sep) || value.includes('/') || value.includes('\\')) return existsSync(value);
  const pathValue = process.env.PATH || process.env.Path || '';
  const extensions = process.platform === 'win32' ? ['', ...(process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')] : [''];
  return pathValue.split(path.delimiter).filter(Boolean).some((folder) => extensions.some((extension) => existsSync(path.join(folder, value + extension))));
}

function extractModelText(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    return parsed.text || parsed.output_text || parsed.message?.content || parsed.result || trimmed;
  } catch {
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    const jsonLines = lines.map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
    if (jsonLines.length) {
      return jsonLines.map((item) => item.text || item.output_text || item.message?.content || item.result || "").filter(Boolean).join("\n");
    }
    return trimmed;
  }
}

function modelLabel(modelId) {
  return modelId.split("/").pop().split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

async function refreshHarnessDetection() {
  detectedHarnesses = await detectHarnesses();
  return detectedHarnesses;
}

async function refreshModelCatalog() {
  const models = [];
  const errors = [];
  for (const connection of state.harnessConnections.filter((item) => item.enabled !== false)) {
    const status = detectedHarnesses.find((item) => item.id === connection.id);
    if (!status?.installed || !status.authenticated) { errors.push(`${status?.label || connection.id} is no longer installed and signed in.`); continue; }
    if (connection.id !== 'opencode') {
      const fallback = defaultHarnessModel(connection.id);
      if (fallback) models.push(fallback);
      continue;
    }
    try {
      const runner = harnessCommand('opencode');
      const result = await runHarnessProcess(runner.command, [...runner.prefixArgs, 'models', '--verbose', '--refresh'], { cwd: ROOT, timeoutMs: 30000 });
      const discovered = parseOpenCodeModels(result.stdout);
      if (!discovered.length) throw new Error('OpenCode returned no readable model metadata.');
      models.push(...discovered.map((model) => ({ ...model, id: `harness:opencode:${model.id}`, harnessId: 'opencode', remoteModel: model.id })));
    } catch (error) { errors.push(cleanString(error.message, 'OpenCode model discovery failed.').slice(0, 500)); }
  }
  modelCatalog = models;
  modelCatalogError = errors.join(' ');
  if (!allowedModel(state.settings.model)) state.settings.model = (state.settings.modelPolicy === 'free-only' ? models.find((model) => model.free) : null)?.id || models[0]?.id || '';
}

function allowedModel(modelId) {
  for (const provider of state.providers || []) {
    const prefix = `provider:${provider.id}:`;
    if (provider.enabled && modelId.startsWith(prefix) && provider.modelIds.includes(modelId.slice(prefix.length))) return { id:modelId, providerId:provider.id, remoteModel:modelId.slice(prefix.length), browser: isOnDeviceProvider(provider) };
  }
  const model = modelCatalog.find((item) => item.id === modelId);
  if (!model) return null;
  if (state.settings.modelPolicy === "free-only" && !model.free) return null;
  return model;
}

async function askModel(prompt, modelId = state.settings.model || MODEL) {
  const route = allowedModel(modelId);
  if (!route) throw new Error('The selected model is unavailable. Choose an available model before sending.');
  if (route?.providerId) {
    const provider = state.providers.find(item => item.id === route.providerId);
    if (route.browser) throw new Error('This model runs inside the selected browser. Send the message from that browser instead.');
    const secret = provider.hasKey ? await credentialVault.get(provider.id) : '';
    const result = await completeWithProvider(provider, secret, route.remoteModel, prompt);
    return result.content.slice(0,20000);
  }
  const selected = route || modelCatalog.find((item) => item.free) || modelCatalog[0];
  if (!selected?.harnessId) throw new Error('Choose a connected model before sending.');
  let result;
  if (selected.harnessId === 'opencode') {
    const runner = resolveOpenCode();
    result = await executeOpenCode({ command: runner.command, prefixArgs: runner.args, prompt, model: selected.remoteModel, cwd: WORKSPACE_DIR, workMode: 'converse', approvalPolicy: 'ask', approved: false, subagents: false });
  } else result = await executeTextHarness({ id: selected.harnessId, prompt, model: selected.remoteModel, cwd: WORKSPACE_DIR });
  return result.content.slice(0, 20000);
}

function bridgeStatus() {
  const runnerPath = resolveIlandsRunner();
  return {
    model: state?.settings?.model || MODEL,
    modelPolicy: state?.settings?.modelPolicy || "free-only",
    modelCatalogError,
    openCodeInstalled: detectedHarnesses.find((item) => item.id === 'opencode')?.installed || false,
    runnerInstalled: Boolean(runnerPath && existsSync(runnerPath)),
    runnerBoundary: 'official-harness',
    runnerWorldRuntimeActive: (state?.runnerProfiles || []).some((profile) => managedRunnerStatus(profile.id).running),
    runnerMessaging: false,
    dashboardDirectMessaging: false,
    dashboardChatTransport: 'local-only',
    liveMedia: {
      supported: false,
      transport: 'runner-native',
      reason: 'The Runner itself is not used as the camera or WebRTC transport. HexiGrid provides those device channels and can invite an iLands agent through its working email or agent-authored external tools.'
    },
    externalAgentChannels: {
      emailBridge: true,
      agentAuthoredTools: true,
      hexigridLiveMedia: true
    },
    supportedRunnerHarnesses: supportedRunnerHarnesses(),
    host: HOST,
    port: PORT,
    checkedAt: now(),
    officialGuide: 'https://ilands.ai/agent.md'
  };
}

async function officialRunnerStatus() {
  const bridge = bridgeStatus();
  if (!bridge.runnerInstalled) return { ...bridge, ready: false, message: 'Install the official iLands Runner through the live BYOA guide first.' };
  const profiles = await Promise.all((state.runnerProfiles || []).map(async (profile) => ({ id: profile.id, label: profile.label, ...(await runnerProfileStatus(profile)), runtime: managedRunnerStatus(profile.id) })));
  const ready = profiles.some((profile) => profile.connection === 'connected' || profile.runtime.running);
  return { ...bridge, ready, profiles, message: ready ? 'At least one official Runner profile is active.' : profiles.length ? 'Runner is installed; finish or start a profile connection.' : 'Runner is installed. Add an iLands account connection.' };
}

function findRunnerProfile(profileId) {
  return (state.runnerProfiles || []).find((profile) => profile.id === profileId);
}

function connectorPolicy(capability, risk, approved) {
  const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability, risk });
  if (policy.decision === 'deny') return { error: policy.reason, denied: true, policy };
  if (policy.decision === 'ask' && approved !== true) return { error: policy.reason, approvalRequired: true, policy };
  return null;
}

function highestRisk(values) {
  const order = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return [...values].sort((left, right) => (order[right] || 2) - (order[left] || 2))[0] || 'medium';
}

async function syncRunnerProfileFromJob(profile, job) {
  if (!job) return;
  if (['complete', 'failed', 'cancelled'].includes(job.state) && !state.receipts.some((receipt) => receipt.action === `runner:${job.id}`)) {
    const status = job.state === 'complete' ? 'completed' : job.state;
    addReceipt({ action: `runner:${job.id}`, capability: job.action === 'bind' ? 'external_write' : 'run_tools', risk: job.action === 'bind' ? 'high' : 'medium', status, detail: job.state === 'complete' ? `${profile.label} ${job.action} completed.` : `${profile.label} ${job.action} ${job.state}: ${job.error || 'No further detail.'}`, source: 'ilands-runner' });
    addActivity('connection', job.state === 'complete' ? `${profile.label} Runner ${job.action} completed.` : `${profile.label} Runner ${job.action} ${job.state}.`);
  }
  if (job.state !== 'complete') { await saveState(); return; }
  const completion = [...job.events].reverse().find((event) => event.event === 'runner_complete');
  let agentId = completion?.agentId || null;
  if (!agentId) agentId = (await runnerProfileStatus(profile)).agentId;
  if (!agentId || profile.agentId === agentId) { await saveState(); return; }
  profile.agentId = agentId;
  let agent = state.agents.find((item) => item.runnerProfileId === profile.id || item.ilandsAgentId === agentId);
  if (!agent) {
    agent = {
      id: id('agent'), name: profile.label, transport: 'ilands-runner', model: state.settings.model,
      runnerProfileId: profile.id, ilandsAgentId: agentId, harness: profile.harness,
      personality: '', instructions: '', rules: '', useGlobalCommunication: true, avatarImage: '',
      status: 'connected', createdAt: now()
    };
    state.agents.push(agent);
    profile.agentProfileId = agent.id;
    for (const room of state.rooms) if (!room.agentIds.includes(agent.id)) room.agentIds.push(agent.id);
    addActivity('connection', `${profile.label} was populated from its verified iLands Runner connection.`);
  } else {
    agent.runnerProfileId = profile.id; agent.ilandsAgentId = agentId; agent.harness = profile.harness; agent.status = 'connected';
    profile.agentProfileId = agent.id;
  }
  await saveState();
}

function setupGuide() {
  return {
    officialHome: "https://ilands.ai/",
    byoa: "https://ilands.ai/byoa",
    agentGuide: "https://ilands.ai/agent.md",
    currentHarnesses: supportedRunnerHarnesses(),
    steps: [
      "Install the checksum-verified official Runner once from an ordinary PowerShell window.",
      "Add one isolated connection profile for each iLands account.",
      "Choose the same certified harness that created the BYOA agent, prepare it, then open the approval link shown by Connect.",
      "Sign in to the matching iLands account and approve the device. HexiGrid records the returned agent ID automatically.",
      "Keep HexiGrid running to supervise multiple Runner profiles together on one computer."
    ],
    safety: "HexiGrid never asks for an iLands password or handles private iLands API tokens. Device credentials remain in each official Runner home; only public authorization events and local profile metadata enter the dashboard."
  };
}

async function localProfileReply(agent, transcript, { approved = false, source = 'room', signal, imageDataUrl = '' } = {}) {
  const memories = (state.memories || []).filter((memory) => memory.agentId === agent.id).sort((left, right) => right.importance - left.importance || new Date(right.updatedAt) - new Date(left.updatedAt)).slice(0, 100);
  const prompt = [
    `You are ${agent.name}, an agent profile in HexiGrid.`,
    agent.personality ? `Personality:\n${agent.personality}` : "Personality: not configured yet.",
    agent.instructions ? `Standing instructions:\n${agent.instructions}` : "Standing instructions: be helpful, concise, and explicit about uncertainty.",
    agent.rules ? `Rules:\n${agent.rules}` : "Rules: never claim access to iLands or external tools unless the dashboard confirms it.",
    memories.length ? `Owner-managed memory:\n${memories.map((memory) => `- [${memory.category}] ${memory.content}`).join('\n')}` : 'Owner-managed memory: none yet.',
    agent.useGlobalCommunication !== false ? compileCommunicationPrompt(state.settings.communicationGuide) : "",
    `Current work mode: ${WORK_MODES[state.settings.workMode]?.label || "Converse"}.`,
    state.settings.activeGoal?.title ? `Current shared goal: ${state.settings.activeGoal.title}` : "There is no active shared goal.",
    agent.transport === 'ilands-runner'
      ? "This profile has an iLands Runner identity/status connection, but this HexiGrid conversation stays local and is not delivered to iLands. Do not claim that this message, reply, or any action reached iLands unless a separate verified Runner tool receipt proves that action."
      : "This is a local model conversation. Do not claim to have used an external tool unless a verified tool receipt is present.",
    "Other named agents in the transcript are real participants in this room. You may respond to their ideas directly and should avoid needlessly repeating them.",
    `Conversation:\n${transcript}`,
    "Reply as this agent only."
  ].join("\n\n");
  const model = agent.model || state.settings.model;
  const route = allowedModel(model);
  if (route?.providerId) {
    const provider = state.providers.find(item => item.id === route.providerId);
    if (route.browser) throw new Error('This model runs inside the selected browser. Send the message from that browser instead.');
    const providerPrompt = imageDataUrl ? { text: `${prompt}\n\nThe owner deliberately attached one current camera or screen frame. Describe only what is visible and do not infer hidden details.`, imageDataUrl } : prompt;
    const result = await completeWithProvider(provider,provider.hasKey ? await credentialVault.get(provider.id) : '',route.remoteModel,providerPrompt, { signal });
    recordUsage({agentId:agent.id,model,inputText:prompt,outputText:result.content,inputTokens:result.inputTokens,outputTokens:result.outputTokens,source});
    return result.content;
  }
  const workspace = agentWorkspace(agent.id);
  if (imageDataUrl) throw new Error('The selected CLI connection accepts text only here. Choose a vision-capable API model to share a frame.');
  await fs.mkdir(workspace, { recursive: true });
  if (!route?.harnessId) throw new Error('The selected local harness is not connected. Choose a model in Connections.');
  let result;
  if (route.harnessId === 'opencode') {
    const runner = resolveOpenCode();
    result = await executeOpenCode({
      command: runner.command, prefixArgs: runner.args, prompt, model: route.remoteModel,
      sessionId: agent.runtimeSessionId || null, cwd: workspace,
      workMode: state.settings.workMode, approvalPolicy: state.settings.approvalPolicy,
      approved, subagents: state.settings.subagents.enabled, signal
    });
  } else result = await executeTextHarness({ id: route.harnessId, prompt, model: route.remoteModel, cwd: workspace, signal });
  if (result.sessionId) agent.runtimeSessionId = result.sessionId;
  recordUsage({agentId:agent.id,model,inputText:prompt,outputText:result.content,inputTokens:result.inputTokens,outputTokens:result.outputTokens,source});
  for (const tool of result.toolReceipts || []) addReceipt({ agentId: agent.id, action: tool.tool, capability: 'run_tools', risk: 'medium', status: tool.status, detail: `Reported by ${route.harnessId} session ${result.sessionId || 'unknown'}.`, source: route.harnessId });
  return result.content;
}

async function respondForAgent(agent, transcript, options = {}) {
  if (!agent) return { ok: false, error: "Agent not found." };
  if (agent.transport === "local-opencode" || agent.transport === 'ilands-runner') {
    try {
      const content = await localProfileReply(agent, transcript, options);
      return {
        ok: true,
        content,
        transport: 'hexigrid-local-chat',
        delivery: 'local-only',
        connector: agent.transport === 'ilands-runner' ? { id: 'ilands', linked: true, directMessaging: false } : null
      };
    } catch (error) {
      return { ok: false, error: `The selected local AI connection is unavailable: ${error.message}` };
    }
  }
  return {
    ok: false,
    error: `${agent.name} is not connected through an iLands Runner yet. Complete the official BYOA setup, then add its agent ID and runner home here.`
  };
}

const activeTaskRuns = new Map();
const liveAudioClips = new Map();
function stopExecutionForRestore() {
  const activeTasks = activeTaskRuns.size;
  for (const controller of activeTaskRuns.values()) controller.abort('restore');
  return { activeTasks, runnerJobsStopped: stopAllRunnerJobs(), runnersStopped: stopAllManagedRunners() };
}

function taskPolicy() {
  const capability = state.settings.workMode === 'watch' ? 'schedule' : 'spawn_subagents';
  return evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability, risk: 'medium' });
}

async function runTaskOnce(task, approved = false) {
  if (activeTaskRuns.has(task.id)) return { ok: false, error: 'This task is already running.' };
  const policy = taskPolicy();
  if (policy.decision === 'deny' || (policy.decision === 'ask' && !approved)) {
    task.status = policy.decision === 'deny' ? 'blocked' : 'waiting_approval';
    task.lastError = policy.reason;
    task.updatedAt = now();
    await saveState();
    return { ok: false, policy };
  }
  const target = findAgent(task.agentId);
  if (!target) { task.status = 'failed'; task.lastError = 'The selected agent no longer exists.'; await saveState(); return { ok: false, error: task.lastError }; }
  const controller = new AbortController();
  activeTaskRuns.set(task.id, controller);
  const run = { id: id('run'), taskId: task.id, status: 'running', startedAt: now(), output: '', error: '' };
  state.taskRuns.unshift(run); state.taskRuns = state.taskRuns.slice(0, 10000);
  try {
    const context = task.lastOutput ? `Previous run output:\n${task.lastOutput}` : 'There is no previous run output.';
    const response = await respondForAgent(target, `Autonomous task: ${task.name}\nGoal/instructions:\n${task.prompt}\n\n${context}\n\nComplete one bounded step. Be clear about what you did and what remains. Do not claim an external action unless a receipt exists.`, { approved, source: 'task', signal: controller.signal });
    if (!response.ok) throw new Error(response.error);
    task.lastOutput = response.content.slice(0, 20000);
    task.lastError = '';
    task.retryCount = 0;
    task.runCount = Number(task.runCount || 0) + 1;
    task.updatedAt = now();
    run.status = 'completed'; run.output = task.lastOutput; run.finishedAt = now();
    if (task.maxRuns > 0 && task.runCount >= task.maxRuns) task.status = 'completed';
    else if (task.intervalSeconds > 0) task.nextRunAt = new Date(Date.now() + task.intervalSeconds * 1000).toISOString();
    else task.status = 'completed';
    addActivity('task', `${task.name} completed autonomous step ${task.runCount}.`);
    addReceipt({ agentId: target.id, action: task.name, capability: 'schedule', risk: 'medium', status: 'completed', detail: `Autonomous run ${run.id} completed.`, source: 'task' });
    await saveState();
    return { ok: true, run };
  } catch (error) {
    const emergencyStopped = controller.signal.reason === 'emergency-stop';
    const cancelled = !emergencyStopped && (controller.signal.aborted || task.status === 'cancelled');
    const retryLimit = Math.min(10, Math.max(0, Number(task.maxRetries) || 0));
    const retryCount = Math.max(0, Number(task.retryCount) || 0);
    const retryScheduled = !emergencyStopped && !cancelled && retryCount < retryLimit;
    const retryDelay = Math.min(300, 5 * (2 ** retryCount));
    task.retryCount = retryScheduled ? retryCount + 1 : retryCount;
    task.status = emergencyStopped ? 'paused' : cancelled ? 'cancelled' : retryScheduled ? 'running' : 'failed';
    task.nextRunAt = retryScheduled ? new Date(Date.now() + retryDelay * 1000).toISOString() : null;
    task.lastError = emergencyStopped ? 'Emergency stop engaged by the owner.' : cancelled ? 'Stopped by the owner.' : retryScheduled ? `${error.message} Retrying attempt ${task.retryCount} of ${retryLimit} in ${retryDelay} seconds.` : error.message;
    task.updatedAt = now();
    run.status = emergencyStopped || cancelled ? 'cancelled' : 'failed'; run.error = task.lastError; run.finishedAt = now();
    addReceipt({ agentId: target.id, action: task.name, capability: 'schedule', risk: 'medium', status: run.status, detail: task.lastError, source: 'task' });
    addActivity('task', emergencyStopped ? `${task.name} was paused by the emergency stop.` : cancelled ? `${task.name} was stopped.` : retryScheduled ? `${task.name} failed and will retry automatically.` : `${task.name} failed: ${error.message}`);
    await saveState();
    return { ok: false, error: error.message, run, retryScheduled, retryAt: task.nextRunAt };
  } finally { activeTaskRuns.delete(task.id); }
}

function startTaskWorker() {
  setInterval(() => {
    const limit = Math.max(1, Number(state.settings.subagents?.maxConcurrent || 1));
    const available = Math.max(0, limit - activeTaskRuns.size);
    if (!available) return;
    const due = state.tasks.filter((task) => task.status === 'running' && (!task.nextRunAt || new Date(task.nextRunAt).getTime() <= Date.now())).slice(0, available);
    for (const task of due) void runTaskOnce(task);
  }, 1000).unref?.();
}

async function route(req, res) {
  const url = new URL(req.url, `${SERVER_SCHEME}://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const method = req.method || "GET";

  if (networkGate(req, res, url)) return;

  if (method === 'GET' && pathname === '/api/system/identity') return json(res, 200, { product: 'hexigrid', version: APP_VERSION, instanceId: SERVER_INSTANCE_ID, pid: process.pid, port: PORT, scheme: SERVER_SCHEME, developmentFreshStart: DEVELOPMENT_FRESH_START });

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !mutationOriginAllowed(req)) {
    return json(res, 403, { error: "This local API only accepts changes from the HexiGrid app." });
  }
  if (!csrfAllowed(req)) return json(res, 403, { error: 'This browser request is missing the local anti-forgery token.' });

  if (method === 'GET' && pathname === '/api/auth/status') return json(res, 200, authStatus(req), csrfHeaders(req));
  if (method === 'POST' && pathname === '/api/auth/setup') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Create the owner account on the computer running HexiGrid.' });
    const existingAuth = authStatus(req);
    if (state.settings.auth?.hash) return json(res, 409, { error: 'A local passcode is already configured.' });
    if (state.settings.auth?.configured && !existingAuth.authenticated) return json(res, 401, { error: 'Continue with the linked Google account before adding a local passcode.' });
    const body = await readBody(req);
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 10) return json(res, 400, { error: 'Use a local passcode with at least 10 characters.' });
    const result = await hashPassword(password);
    const recoveryCode = crypto.randomBytes(18).toString('base64url').toUpperCase().match(/.{1,6}/g).join('-');
    const recovery = await hashPassword(recoveryCode);
    state.settings.auth = { ...state.settings.auth, configured: true, provider: state.settings.auth?.googleSubject ? 'google+local' : 'local', salt: result.salt, hash: result.hash, recoverySalt: recovery.salt, recoveryHash: recovery.hash };
    addReceipt({ action: 'auth:setup', capability: 'manage_sessions', risk: 'high', status: 'completed', detail: 'The local owner passcode and one-time recovery code were created.', source: 'security' });
    addActivity('security', 'A local sign-in passcode was created for this device.');
    await saveState();
    return json(res, 200, { ok: true, recoveryCode, recoveryNotice: 'Save this code offline. It is shown only once.', auth: authStatus(req) }, { 'set-cookie': startSession(req) });
  }
  if (method === 'POST' && pathname === '/api/auth/login') {
    if (!state.settings.auth?.configured) return json(res, 409, { error: 'Create the local passcode first.' });
    const limit = loginLimit(req);
    if (limit.blocked) return json(res, 429, { error: 'Too many sign-in attempts. Try again later.', retryAfter: limit.retryAfter }, { 'retry-after': String(limit.retryAfter) });
    const body = await readBody(req);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!state.settings.auth?.hash) return json(res, 409, { error: 'This workspace uses Google sign-in. Choose Continue with Google.' });
    const valid = password.length > 0 && await verifyPassword(password, state.settings.auth.salt, state.settings.auth.hash);
    if (!valid) {
      const failed = recordLoginFailure(req);
      return json(res, 401, { error: 'That passcode is not correct.', attemptsRemaining: Math.max(0, maxLoginAttempts - (loginAttempts.get(loginKey(req))?.count || 0)), retryAfter: failed.blocked ? failed.retryAfter : 0 });
    }
    clearLoginFailures(req);
    addReceipt({ action: 'auth:login', capability: 'manage_sessions', risk: 'low', status: 'completed', detail: 'A local owner session was opened.', source: 'security' });
    addActivity('security', 'A local session was opened.');
    return json(res, 200, { ok: true, auth: { configured: true, authenticated: true, provider: 'local' } }, { 'set-cookie': startOrRefreshSession(req) });
  }
  if (method === 'POST' && pathname === '/api/auth/google/firebase') {
    const limit = loginLimit(req);
    if (limit.blocked) return json(res, 429, { error: 'Too many sign-in attempts. Try again later.', retryAfter: limit.retryAfter }, { 'retry-after': String(limit.retryAfter) });
    const body = await readBody(req);
    let identity;
    try { identity = await verifyFirebaseIdToken(body.idToken); }
    catch (error) {
      const failed = recordLoginFailure(req);
      return json(res, 401, { error: error.message, retryAfter: failed.blocked ? failed.retryAfter : 0 });
    }
    const current = authStatus(req);
    const linkedSubject = String(state.settings.auth?.googleSubject || '');
    if (linkedSubject && !safeEqual(linkedSubject, identity.subject)) {
      const failed = recordLoginFailure(req);
      return json(res, 403, { error: 'That Google account is not the owner linked to this workspace.', retryAfter: failed.blocked ? failed.retryAfter : 0 });
    }
    if (state.settings.auth?.configured && !linkedSubject && !current.authenticated) {
      return json(res, 401, { error: 'Unlock with the local passcode once, then connect Google in Settings.' });
    }
    state.settings.auth = {
      ...state.settings.auth,
      configured: true,
      provider: state.settings.auth?.hash ? 'google+local' : 'google',
      googleSubject: identity.subject,
      googleEmail: identity.email
    };
    state.settings.sync.status = 'connected';
    state.settings.sync.enabled = true;
    clearLoginFailures(req);
    if (!current.authenticated || !linkedSubject) {
      addReceipt({ action: linkedSubject ? 'auth:google-login' : 'google:connect', capability: 'manage_sessions', risk: 'medium', status: 'completed', detail: linkedSubject ? 'The linked Google identity opened a local HexiGrid session.' : 'Google sign-in and private Drive app-data access were linked to this workspace.', source: 'google' });
      addActivity('security', linkedSubject ? 'The linked Google account opened this workspace.' : 'Google sign-in was connected. Backups remain opt-in and encrypted before upload.');
      await saveState();
    }
    return json(res, 200, { ok: true, account: { email: identity.email, name: identity.name }, auth: { ...authStatus(req), authenticated: true } }, { 'set-cookie': startOrRefreshSession(req) });
  }
  if (method === 'POST' && pathname === '/api/auth/recover') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Recover the owner account on the computer running HexiGrid.' });
    if (!state.settings.auth?.recoveryHash) return json(res, 409, { error: 'No recovery code is configured for this workspace.' });
    const limit = loginLimit(req);
    if (limit.blocked) return json(res, 429, { error: 'Too many recovery attempts. Try again later.', retryAfter: limit.retryAfter }, { 'retry-after': String(limit.retryAfter) });
    const body = await readBody(req);
    const recoveryCode = cleanString(body.recoveryCode).toUpperCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 10) return json(res, 400, { error: 'Use a new local passcode with at least 10 characters.' });
    const valid = recoveryCode && await verifyPassword(recoveryCode, state.settings.auth.recoverySalt, state.settings.auth.recoveryHash);
    if (!valid) { const failed = recordLoginFailure(req); return json(res, 401, { error: 'That recovery code is not correct.', retryAfter: failed.blocked ? failed.retryAfter : 0 }); }
    const replacement = await hashPassword(password);
    const nextRecoveryCode = crypto.randomBytes(18).toString('base64url').toUpperCase().match(/.{1,6}/g).join('-');
    const nextRecovery = await hashPassword(nextRecoveryCode);
    state.settings.auth = { ...state.settings.auth, configured: true, provider: state.settings.auth?.googleSubject ? 'google+local' : 'local', salt: replacement.salt, hash: replacement.hash, recoverySalt: nextRecovery.salt, recoveryHash: nextRecovery.hash };
    sessions.clear(); clearLoginFailures(req);
    addReceipt({ action: 'auth:recover', capability: 'manage_sessions', risk: 'critical', status: 'completed', detail: 'The owner passcode was replaced and earlier sessions were revoked.', source: 'security' });
    addActivity('security', 'The owner passcode was recovered and all earlier sessions were revoked.');
    await saveState();
    return json(res, 200, { ok: true, recoveryCode: nextRecoveryCode, recoveryNotice: 'This replaces the old recovery code. Save it offline.' }, { 'set-cookie': startSession(req) });
  }
  if (method === 'POST' && pathname === '/api/auth/logout') { addReceipt({ action: 'auth:logout', capability: 'manage_sessions', risk: 'low', status: 'completed', detail: 'The current owner session was closed.', source: 'security' }); await saveState(); return json(res, 200, { ok: true }, { 'set-cookie': clearSession(req) }); }
  if (authGate(req, res, url)) return;

  if (method === 'DELETE' && pathname === '/api/auth/google') {
    if (!state.settings.auth?.hash) return json(res, 409, { error: 'Add a local passcode before disconnecting your only sign-in method.' });
    delete state.settings.auth.googleSubject;
    delete state.settings.auth.googleEmail;
    state.settings.auth.provider = 'local';
    state.settings.sync.status = 'not_configured';
    state.settings.sync.enabled = false;
    addReceipt({ action: 'google:disconnect', capability: 'manage_sessions', risk: 'high', status: 'completed', detail: 'Google sign-in and Drive access were disconnected. Existing encrypted files remain in the user’s Drive until they delete them.', source: 'google' });
    addActivity('security', 'Google was disconnected from this workspace.');
    await saveState();
    return json(res, 200, { ok: true, auth: authStatus(req) });
  }

  if (method === 'GET' && pathname === '/api/agent-interface') return json(res, 200, agentInterfaceManifest({ version: APP_VERSION }));

  if (method === 'POST' && pathname === '/api/emergency/stop') {
    const activeTasks = activeTaskRuns.size;
    let pausedTasks = 0;
    for (const task of state.tasks) {
      if (task.status === 'running' || task.status === 'waiting_approval') {
        task.status = 'paused';
        task.nextRunAt = null;
        task.lastError = 'Emergency stop engaged by the owner.';
        task.updatedAt = now();
        pausedTasks += 1;
      }
    }
    for (const controller of activeTaskRuns.values()) controller.abort('emergency-stop');
    const runnerJobsStopped = stopAllRunnerJobs();
    const runnersStopped = stopAllManagedRunners();
    addReceipt({ action: 'emergency-stop', capability: 'emergency_stop', risk: 'critical', status: 'completed', detail: `Paused ${pausedTasks} task(s), interrupted ${activeTasks} active task run(s), stopped ${runnerJobsStopped} Runner setup job(s), and stopped ${runnersStopped} Runner process(es).`, source: 'owner' });
    addActivity('security', 'The owner emergency stop paused autonomous work and stopped managed Runner processes.');
    await saveState();
    return json(res, 200, { ok: true, pausedTasks, activeTasks, runnerJobsStopped, runnersStopped });
  }

  if (method === 'GET' && pathname === '/api/auth/sessions') return json(res, 200, { sessions: publicSessions(req) });
  const sessionMatch = pathname.match(/^\/api\/auth\/sessions\/([a-z0-9-]+)$/);
  if (method === 'DELETE' && sessionMatch) {
    let removed = false;
    for (const [token, session] of sessions) if (session.id === sessionMatch[1]) { sessions.delete(token); removed = true; break; }
    if (!removed) return json(res, 404, { error: 'That session is no longer active.' });
    addReceipt({ action: 'auth:revoke-session', capability: 'manage_sessions', risk: 'high', status: 'completed', detail: 'A signed-in device session was revoked by the owner.', source: 'security' });
    addActivity('security', 'A signed-in device session was revoked.');
    return json(res, 200, { ok: true });
  }

  if (method === "GET" && pathname === "/api/bootstrap") return json(res, 200, { ...publicState(), guide: setupGuide() });
  if (method === 'GET' && pathname === '/brand.js') { res.writeHead(200,securityHeaders('text/javascript; charset=utf-8')); return res.end(`const PRODUCT = Object.freeze(${JSON.stringify(BRAND)});`); }

  if (method === 'POST' && pathname === '/api/backup/export') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Create encrypted backup files on the computer running HexiGrid.' });
    const body = await readBody(req);
    try {
      const envelope = encryptBackup(await backupPayload(), cleanString(body.passphrase).slice(0, 400));
      const receipt = addReceipt({ action: 'backup:export', capability: 'write_backup', risk: 'medium', status: 'completed', detail: 'An authenticated encrypted backup was created locally. OS-vault secrets were excluded.', source: 'backup' });
      addActivity('security', 'An encrypted local backup was created. OS-stored provider keys were not exported.');
      await saveState();
      return json(res, 200, { envelope, filename: `hexigrid-backup-${new Date().toISOString().slice(0, 10)}.json`, receipt });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (method === 'POST' && pathname === '/api/backup/import') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Restore encrypted backup files on the computer running HexiGrid.' });
    const body = await readBody(req, MAX_BACKUP_BODY_BYTES);
    const denied = connectorPolicy('write_workspace', 'high', body.approved);
    if (denied) return json(res, denied.denied ? 403 : 409, denied);
    try {
      const incoming = decryptBackup(body.envelope, cleanString(body.passphrase).slice(0, 400));
      const stopped = stopExecutionForRestore();
      await restoreState(incoming);
      state.recovery.lastRestoreAt = now();
      const receipt = addReceipt({ action: 'backup:import', capability: 'restore_backup', risk: 'high', status: 'completed', detail: `An authenticated encrypted backup was verified locally and restored with automation paused for review. Stopped ${stopped.activeTasks} task run(s), ${stopped.runnerJobsStopped} Runner setup job(s), and ${stopped.runnersStopped} Runner process(es).`, source: 'backup' });
      addActivity('security', 'An encrypted local backup was restored. Provider keys must be entered again on this device.');
      await saveState();
      return json(res, 200, { ok: true, state: publicState(), receipt });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (method === 'POST' && pathname === '/api/backup/rollback') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Roll back a backup restore on the computer running HexiGrid.' });
    if (!state.recovery?.lastRestoreAt) return json(res, 409, { error: 'There is no recent restore to roll back.' });
    const body = await readBody(req);
    const denied = connectorPolicy('write_workspace', 'high', body.approved);
    if (denied) return json(res, denied.denied ? 403 : 409, denied);
    try {
      const stopped = stopExecutionForRestore();
      const previous = await stateStore.readPrevious();
      const files = await rollbackPortableFiles({ workspace: WORKSPACE_DIR, media: MEDIA_DIR, plugins: PLUGIN_DIR });
      await restoreState(previous, { restoreFiles: false, protectImported: false });
      state.recovery.lastRestoreAt = null;
      addActivity('security', 'The previous local state and private files were restored after the last backup restore.');
      addReceipt({ action: 'backup-rollback', capability: 'restore_backup', risk: 'high', status: 'completed', detail: `Rolled back the last restore across ${files.rolledBack} private data area(s), after stopping ${stopped.activeTasks} task run(s), ${stopped.runnerJobsStopped} Runner setup job(s), and ${stopped.runnersStopped} Runner process(es).`, source: 'owner' });
      await saveState();
      return json(res, 200, { ok: true, state: publicState() });
    } catch (error) { return json(res, 400, { error: `The last restore could not be rolled back: ${error.message}` }); }
  }

  if (pathname === '/api/plugins/install' && method === 'POST') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Install plugins on the computer that runs HexiGrid.' });
    const body = await readBody(req, MAX_PLUGIN_BODY_BYTES);
    try {
      const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability: 'write_workspace', risk: 'high' });
      if (policy.decision === 'deny') return json(res, 403, { error: policy.reason, denied: true, policy });
      if (policy.decision === 'ask' && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy });
      const identity = buildPackageIdentity(body.manifest, body.files);
      let trustedPublisherKey = '';
      let trustPublisherAfterInstall = false;
      if (identity.manifest.publisher) {
        verifyPublisherSignature(identity.manifest);
        trustedPublisherKey = await credentialVault.get(pluginPublisherVaultId(identity.manifest.publisher.id));
        if (!trustedPublisherKey) {
          if (body.trustPublisher !== true) return json(res, 409, {
            error: 'Review and trust this publisher key before installation.', publisherTrustRequired: true,
            publisher: { id: identity.manifest.publisher.id, name: identity.manifest.publisher.name, fingerprint: publisherFingerprint(identity.manifest.publisher.publicKey) }
          });
          trustedPublisherKey = identity.manifest.publisher.publicKey;
          trustPublisherAfterInstall = true;
        }
      }
      const manifest = await installPluginPackage({ pluginRoot: PLUGIN_DIR, manifest: body.manifest, files: body.files, trustMode: body.localOwnerApproved === true ? 'owner-local' : '', trustedPublisherKey });
      if (trustPublisherAfterInstall) {
        await credentialVault.set(pluginPublisherVaultId(manifest.publisher.id), manifest.publisher.publicKey);
        state.pluginPublishers = state.pluginPublishers.filter((item) => item.id !== manifest.publisher.id);
        state.pluginPublishers.push({ id: manifest.publisher.id, name: manifest.publisher.name, fingerprint: manifest.publisherFingerprint, trusted: true });
      }
      const record = { ...manifest, enabled: false, quarantined: false, quarantineReason: '', secretStatus: Object.fromEntries(manifest.secrets.map((item) => [item.id, false])), installedAt: now(), lastRunAt: null };
      state.plugins = state.plugins.filter((item) => item.id !== manifest.id);
      state.plugins.push(record);
      addReceipt({ action: `${manifest.id}:install`, capability: 'write_workspace', risk: 'high', status: 'completed', detail: `${manifest.name} ${manifest.package.digest} was verified and installed disabled (${manifest.trust}).`, source: 'plugin' });
      addActivity('plugin', `${manifest.name} was installed and is disabled until you review its declared permissions.`);
      await saveState();
      return json(res, 201, { plugin: safePluginRecord(record) });
    } catch (error) {
      if (error.code === 'LOCAL_TRUST_REQUIRED') return json(res, 409, { error: error.message, localTrustRequired: true });
      return json(res, 400, { error: error.message });
    }
  }
  const publisherMatch = pathname.match(/^\/api\/plugin-publishers\/([a-z0-9-]+)$/);
  if (publisherMatch && method === 'DELETE') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Revoke publisher trust on the computer running HexiGrid.' });
    const body = await readBody(req);
    const denied = connectorPolicy('run_tools', 'high', body.approved);
    if (denied) return json(res, denied.denied ? 403 : 409, denied);
    await credentialVault.remove(pluginPublisherVaultId(publisherMatch[1]));
    state.pluginPublishers = state.pluginPublishers.filter((item) => item.id !== publisherMatch[1]);
    for (const plugin of state.plugins.filter((item) => item.publisher?.id === publisherMatch[1])) quarantinePlugin(plugin, 'The owner revoked this publisher key.');
    addReceipt({ action: `${publisherMatch[1]}:revoke-publisher`, capability: 'run_tools', risk: 'high', status: 'completed', detail: 'Publisher trust was revoked and its installed plugins were quarantined.', source: 'plugin' });
    await saveState();
    return json(res, 200, { ok: true });
  }
  const pluginMatch = pathname.match(/^\/api\/plugins\/([a-z0-9-]+)(?:\/(run|enable|secrets))?$/);
  if (pluginMatch) {
    const plugin = state.plugins.find((item) => item.id === pluginMatch[1]);
    if (!plugin) return json(res, 404, { error: 'Plugin not found.' });
    if (method === 'PATCH' && pluginMatch[2] === 'enable') {
      const body = await readBody(req);
      const enabled = body.enabled === true;
      if (enabled) {
        const verified = await verifyPluginForUse(plugin);
        if (!verified.ok) { await saveState(); return json(res, 409, { error: `Plugin is quarantined: ${verified.error}`, quarantined: true }); }
      }
      const pluginRisk = highestRisk(plugin.capabilities.map((capability) => capability.risk));
      if (enabled) {
        const denied = connectorPolicy('run_tools', pluginRisk, body.approved);
        if (denied) return json(res, denied.denied ? 403 : 409, { ...denied, plugin: plugin.id });
      }
      plugin.enabled = enabled;
      addReceipt({ action: `${plugin.id}:${plugin.enabled ? 'enable' : 'disable'}`, capability: 'run_tools', risk: plugin.enabled ? pluginRisk : 'low', status: 'completed', detail: `${plugin.name} was ${plugin.enabled ? 'enabled' : 'disabled'} by the owner.`, source: 'plugin' });
      addActivity('plugin', `${plugin.name} was ${plugin.enabled ? 'enabled' : 'disabled'}.`);
      await saveState();
      return json(res, 200, { plugin: safePluginRecord(plugin) });
    }
    if (method === 'PUT' && pluginMatch[2] === 'secrets') {
      if (!isHostRequest(req)) return json(res, 403, { error: 'Configure plugin credentials on the computer running HexiGrid.' });
      const body = await readBody(req);
      const denied = connectorPolicy('run_tools', 'high', body.approved);
      if (denied) return json(res, denied.denied ? 403 : 409, denied);
      const supplied = body.secrets && typeof body.secrets === 'object' && !Array.isArray(body.secrets) ? body.secrets : {};
      for (const secret of plugin.secrets) {
        if (!(secret.id in supplied)) continue;
        const value = typeof supplied[secret.id] === 'string' ? supplied[secret.id] : '';
        if (value) { await credentialVault.set(pluginSecretVaultId(plugin.id, secret.id), value); plugin.secretStatus[secret.id] = true; }
        else { await credentialVault.remove(pluginSecretVaultId(plugin.id, secret.id)); plugin.secretStatus[secret.id] = false; }
      }
      addReceipt({ action: `${plugin.id}:credentials`, capability: 'run_tools', risk: 'high', status: 'completed', detail: 'Plugin credentials were updated in the OS-backed vault; values were not stored in app state.', source: 'plugin' });
      await saveState();
      return json(res, 200, { plugin: safePluginRecord(plugin) });
    }
    if (method === 'DELETE' && !pluginMatch[2]) {
      const body = await readBody(req);
      const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability: 'write_workspace', risk: 'high' });
      if (policy.decision === 'deny') return json(res, 403, { error: policy.reason, denied: true, policy });
      if (policy.decision === 'ask' && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy });
      await fs.rm(pluginFolder(plugin.id), { recursive: true, force: true });
      for (const secret of plugin.secrets || []) await credentialVault.remove(pluginSecretVaultId(plugin.id, secret.id));
      state.plugins = state.plugins.filter((item) => item.id !== plugin.id);
      addReceipt({ action: `${plugin.id}:remove`, capability: 'write_workspace', risk: 'high', status: 'completed', detail: `${plugin.name} was removed.`, source: 'plugin' });
      addActivity('plugin', `${plugin.name} was removed.`);
      await saveState();
      return json(res, 200, { ok: true });
    }
    if (method === 'POST' && pluginMatch[2] === 'run') {
      const body = await readBody(req);
      if (!plugin.enabled) return json(res, 409, { error: 'Enable this plugin after reviewing its permissions.' });
      const verified = await verifyPluginForUse(plugin);
      if (!verified.ok) { await saveState(); return json(res, 409, { error: `Plugin is quarantined: ${verified.error}`, quarantined: true }); }
      const capability = plugin.capabilities.find((item) => item.id === cleanString(body.capability)) || plugin.capabilities[0];
      const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability: 'run_tools', risk: capability.risk });
      if (policy.decision === 'deny') return json(res, 403, { error: policy.reason, denied: true, policy });
      if (policy.decision === 'ask' && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy, capability });
      let validatedInput;
      try { validatedInput = validateSchemaValue(capability.inputSchema, body.input && typeof body.input === 'object' ? body.input : {}, 'Input'); }
      catch (error) { return json(res, 400, { error: error.message, plugin: plugin.id, capability: capability.id }); }
      for (const secret of plugin.secrets.filter((item) => item.required)) {
        if (!await credentialVault.get(pluginSecretVaultId(plugin.id, secret.id))) return json(res, 409, { error: `Configure ${secret.label} before running this plugin.`, credentialRequired: secret.id });
      }
      const controller = new AbortController();
      req.once('aborted', () => controller.abort());
      try {
        const result = await runInstalledPlugin(plugin, capability, validatedInput, controller.signal, body.approved === true);
        plugin.lastRunAt = now();
        for (const brokerReceipt of result.brokerReceipts || []) addReceipt({ action: `${plugin.id}:${brokerReceipt.operation}`, capability: brokerReceipt.operation.startsWith('files.read') ? 'read_workspace' : brokerReceipt.operation.startsWith('files.write') ? 'write_workspace' : 'run_tools', risk: capability.risk, status: brokerReceipt.status, detail: brokerReceipt.target || brokerReceipt.detail, source: 'plugin-broker' });
        addReceipt({ action: `${plugin.id}:${capability.id}`, capability: 'run_tools', risk: capability.risk, status: 'completed', detail: `${plugin.name} completed ${capability.label}.`, source: 'plugin' });
        addActivity('plugin', `${plugin.name} ran ${capability.label}.`);
        await saveState();
        return json(res, 200, { ok: result.ok, result: result.result, plugin: plugin.id, capability: capability.id, policy });
      } catch (error) {
        for (const brokerReceipt of error.brokerReceipts || []) addReceipt({ action: `${plugin.id}:${brokerReceipt.operation}`, capability: brokerReceipt.operation.startsWith('files.read') ? 'read_workspace' : brokerReceipt.operation.startsWith('files.write') ? 'write_workspace' : 'run_tools', risk: capability.risk, status: brokerReceipt.status, detail: brokerReceipt.target || brokerReceipt.detail, source: 'plugin-broker' });
        if (error.code === 'PLUGIN_TAMPERED') quarantinePlugin(plugin, error.message);
        addReceipt({ action: `${plugin.id}:${capability.id}`, capability: 'run_tools', risk: capability.risk, status: 'failed', detail: error.message, source: 'plugin' }); addActivity('plugin', `${plugin.name} failed: ${error.message}`); await saveState(); return json(res, error.code === 'PLUGIN_TAMPERED' ? 409 : 502, { error: error.message, plugin: plugin.id, quarantined: plugin.quarantined === true });
      }
    }
  }

  if (pathname === '/api/mcp' && method === 'GET') return json(res, 200, { servers: state.mcpServers.map(publicMcpRecord) });
  if (pathname === '/api/mcp' && method === 'POST') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Add MCP servers on the computer running HexiGrid.' });
    const body = await readBody(req);
    const denied = connectorPolicy('run_tools', body.transport === 'http' ? 'high' : 'medium', body.approved);
    if (denied) return json(res, denied.denied ? 403 : 409, denied);
    try {
      const validated = validateMcpServer(body);
      if (validated.transport === 'stdio' && validated.workspaceAccess !== 'none') validated.workspaceRoot = WORKSPACE_DIR;
      const server = { id: id('mcp'), ...validated, tools: [], toolSetDigest: '', serverIdentity: '', executableDigest: '', executablePath: '', toolGrants: {}, hasSecrets: false, createdAt: now(), lastCheckedAt: null, lastError: '' };
      const secrets = cleanMcpSecrets(body.secrets);
    if (Object.keys(secrets).length) { await credentialVault.set(`mcp-${server.id}`, JSON.stringify(secrets)); server.hasSecrets = true; }
      state.mcpServers.push(server); addReceipt({ action: `${server.id}:install`, capability: 'run_tools', risk: validated.transport === 'http' ? 'high' : 'medium', status: 'completed', detail: `${server.name} was added disabled for tool review.`, source: 'mcp' }); addActivity('connection', `${server.name} MCP server was added disabled.`); await saveState();
      return json(res, 201, { server: publicMcpRecord(server) });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  const mcpMatch = pathname.match(/^\/api\/mcp\/([a-z0-9-]+)(?:\/(test|enable|call|secrets))?$/);
  if (mcpMatch) {
    const mcp = state.mcpServers.find((item) => item.id === mcpMatch[1]);
    if (!mcp) return json(res, 404, { error: 'MCP server not found.' });
    const action = mcpMatch[2];
    if (method === 'POST' && action === 'test') {
      const body = await readBody(req); const denied = connectorPolicy(mcp.transport === 'http' ? 'network_read' : 'run_tools', 'medium', body.approved);
      if (denied) return json(res, denied.denied ? 403 : 409, denied);
      try {
        const secrets = mcp.hasSecrets ? JSON.parse(await credentialVault.get(`mcp-${mcp.id}`) || '{}') : {};
        const discovery = await discoverMcpServer({ ...mcp, serverIdentity: '', executableDigest: '' }, secrets);
        const changed = Boolean(mcp.toolSetDigest && mcp.toolSetDigest !== discovery.toolSetDigest);
        mcp.tools = discovery.tools; mcp.toolSetDigest = discovery.toolSetDigest; mcp.serverIdentity = discovery.serverIdentity; mcp.executableDigest = discovery.executableDigest; mcp.executablePath = discovery.executablePath; mcp.enabled = false; mcp.lastCheckedAt = now(); mcp.lastError = '';
        mcp.toolGrants = Object.fromEntries(mcp.tools.map((tool) => { const previous = mcp.toolGrants?.[tool.name]; return [tool.name, { capability: previous?.digest === tool.digest ? previous.capability : 'run_tools', risk: previous?.digest === tool.digest ? previous.risk : 'high', approved: false, digest: tool.digest }]; }));
        addReceipt({ action: `${mcp.id}:tools/list`, capability: mcp.transport === 'http' ? 'network_read' : 'run_tools', risk: 'medium', status: 'completed', detail: `${mcp.tools.length} tools discovered and pinned${changed ? '; a changed tool set was disabled' : ''}.`, source: 'mcp' });
        await saveState(); return json(res, 200, { ok: true, server: publicMcpRecord(mcp) });
      } catch (error) { mcp.lastCheckedAt = now(); mcp.lastError = error.message; addReceipt({ action: `${mcp.id}:tools/list`, capability: 'run_tools', risk: 'medium', status: 'failed', detail: error.message, source: 'mcp' }); await saveState(); return json(res, error.status || 502, { error: error.message }); }
    }
    if (method === 'PATCH' && action === 'enable') {
      const body = await readBody(req);
      const allowedCapabilities = new Set(['read_local', 'network_read', 'write_workspace', 'run_tools', 'external_write', 'generate_media']);
      if (body.toolGrants && typeof body.toolGrants === 'object') for (const tool of mcp.tools) {
        const requested = body.toolGrants[tool.name];
        if (requested && allowedCapabilities.has(requested.capability) && ['none', 'low', 'medium', 'high', 'critical'].includes(requested.risk)) mcp.toolGrants[tool.name] = { capability: requested.capability, risk: requested.risk, approved: requested.approved === true, digest: tool.digest };
      }
      if (body.enabled === true && mcp.transport === 'stdio' && (!mcp.image || !mcp.executableDigest)) return json(res, 409, { error: 'Check the digest-pinned Podman image before enabling this local MCP server.' });
      if (body.enabled === true && (!mcp.tools.length || !mcp.toolSetDigest || !mcp.serverIdentity)) return json(res, 409, { error: 'Check this MCP server and review its discovered tools before enabling it.' });
      const enabled = body.enabled === true;
      if (enabled && mcp.tools.some((tool) => mcp.toolGrants?.[tool.name]?.approved !== true || mcp.toolGrants[tool.name].digest !== tool.digest)) return json(res, 409, { error: 'Review and approve a capability and risk for every discovered tool before enabling this server.' });
      const mcpRisk = highestRisk(mcp.tools.map((tool) => mcp.toolGrants[tool.name].risk));
      if (enabled) {
        const denied = connectorPolicy('run_tools', mcpRisk, body.approved);
        if (denied) return json(res, denied.denied ? 403 : 409, { ...denied, server: mcp.id });
      }
      mcp.enabled = enabled;
      addReceipt({ action: `${mcp.id}:${mcp.enabled ? 'enable' : 'disable'}`, capability: 'run_tools', risk: mcp.enabled ? mcpRisk : 'low', status: 'completed', detail: `${mcp.name} was ${mcp.enabled ? 'enabled' : 'disabled'} by the owner.`, source: 'mcp' }); addActivity('connection', `${mcp.name} MCP server was ${mcp.enabled ? 'enabled' : 'disabled'}.`); await saveState();
      return json(res, 200, { server: publicMcpRecord(mcp) });
    }
    if (method === 'PUT' && action === 'secrets') {
      if (!isHostRequest(req)) return json(res, 403, { error: 'Update MCP secrets on the host computer.' });
      const body = await readBody(req); const secrets = cleanMcpSecrets(body.secrets);
      if (!Object.keys(secrets).length) { await credentialVault.remove(`mcp-${mcp.id}`); mcp.hasSecrets = false; }
      else { await credentialVault.set(`mcp-${mcp.id}`, JSON.stringify(secrets)); mcp.hasSecrets = true; }
      mcp.enabled = false; mcp.tools = []; mcp.toolSetDigest = ''; mcp.serverIdentity = ''; mcp.executableDigest = ''; mcp.executablePath = ''; mcp.toolGrants = {}; addReceipt({ action: `${mcp.id}:secrets`, capability: 'run_tools', risk: 'high', status: 'completed', detail: `${mcp.name} credentials were replaced and its tools were disabled for re-review.`, source: 'mcp' }); addActivity('security', `${mcp.name} MCP credentials were replaced in the OS vault.`); await saveState(); return json(res, 200, { server: publicMcpRecord(mcp) });
    }
    if (method === 'POST' && action === 'call') {
      const body = await readBody(req); const tool = mcp.tools.find((item) => item.name === cleanString(body.tool));
      if (!mcp.enabled) return json(res, 409, { error: 'Enable this MCP server before using its tools.' });
      if (!tool) return json(res, 400, { error: 'Choose one of the tools discovered from this MCP server.' });
      const grant = mcp.toolGrants?.[tool.name]; if (!grant?.approved || grant.digest !== tool.digest) return json(res, 409, { error: 'This tool has not been reviewed against its current manifest.' });
      const risk = grant.risk; const denied = connectorPolicy(grant.capability, risk, body.approved);
      if (denied) return json(res, denied.denied ? 403 : 409, { ...denied, tool });
      try {
        const secrets = mcp.hasSecrets ? JSON.parse(await credentialVault.get(`mcp-${mcp.id}`) || '{}') : {};
        const result = await callMcpTool(mcp, secrets, tool.name, body.input || {}, { expectedToolSetDigest: mcp.toolSetDigest, expectedToolDigest: tool.digest });
        addReceipt({ action: `${mcp.id}:${tool.name}`, capability: grant.capability, risk, status: 'completed', detail: `${mcp.name} completed reviewed tool ${tool.name} (${tool.digest.slice(0, 12)}).`, source: 'mcp' }); addActivity('tool', `${mcp.name} ran ${tool.name}.`); await saveState();
        return json(res, 200, { result, receipt: state.receipts[0] });
      } catch (error) { if (['MCP_TOOL_DRIFT', 'MCP_IDENTITY_CHANGED'].includes(error.code)) { mcp.enabled = false; mcp.lastError = error.message; for (const item of Object.values(mcp.toolGrants || {})) item.approved = false; } addReceipt({ action: `${mcp.id}:${tool.name}`, capability: grant.capability, risk, status: 'failed', detail: error.message, source: 'mcp' }); await saveState(); const status = error.status || (['MCP_TOOL_DRIFT', 'MCP_IDENTITY_CHANGED'].includes(error.code) ? 409 : 502); return json(res, status, { error: error.message, disabled: mcp.enabled === false, receipt: state.receipts[0] }); }
    }
    if (method === 'DELETE' && !action) {
      const body = await readBody(req); const denied = connectorPolicy('write_workspace', 'high', body.approved);
      if (denied) return json(res, denied.denied ? 403 : 409, denied);
      await credentialVault.remove(`mcp-${mcp.id}`); state.mcpServers = state.mcpServers.filter((item) => item.id !== mcp.id); addReceipt({ action: `${mcp.id}:remove`, capability: 'write_workspace', risk: 'high', status: 'completed', detail: `${mcp.name} and its protected credentials were removed.`, source: 'mcp' }); addActivity('connection', `${mcp.name} MCP server and its protected credentials were removed.`); await saveState(); return json(res, 200, { ok: true });
    }
  }

  if (pathname === '/api/on-device/providers' && method === 'POST') {
    const body = await readBody(req);
    try {
      const provider = createOnDeviceProvider(body, { id: id('provider'), createdAt: now() });
      state.providers.push(provider);
      addReceipt({ action: `provider:${provider.id}:connect`, capability: 'conversation', risk: 'low', status: 'completed', detail: `${provider.name} was connected to this browser without an API key.`, source: 'browser-webllm' });
      addActivity('connection', `${provider.name} was added. Models run inside the selected browser.`);
      await saveState();
      return json(res, 201, { provider: safeProviderRecord(provider) });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (pathname === '/api/providers' && method === 'POST') {
    if (!isHostRequest(req)) return json(res,403,{error:'Manage API keys on the host computer until encrypted device connections are configured.'});
    const body = await readBody(req);
    let config;
    try { config = validateProvider(body); } catch(error) { return json(res,400,{error:error.message}); }
    let discovery = null;
    if (!config.modelIds.length) {
      try { discovery = await testProviderConnection(config, cleanString(body.apiKey).slice(0, 4000)); }
      catch (error) { return json(res, 502, { error: error.message }); }
      if (!discovery.models.length) return json(res, 422, { error: 'The service connected but did not list its models. Open Advanced settings and enter the model ID supplied by that service.' });
      config.modelIds = discovery.models;
    }
    const provider = { ...config, id:id('provider'), capabilities: Array.isArray(body.capabilities) ? body.capabilities.filter((item) => ['chat', 'image', 'speech', 'realtime'].includes(item)) : ['chat'], hasKey:Boolean(body.apiKey), createdAt:now(), lastCheckedAt: discovery ? now() : undefined, lastError: '' };
    if (!provider.capabilities.length) provider.capabilities = ['chat'];
    if (body.apiKey) await credentialVault.set(provider.id,body.apiKey);
    state.providers.push(provider);
    addReceipt({ action: `provider:${provider.id}:connect`, capability: 'network_read', risk: provider.local ? 'low' : 'medium', status: 'completed', detail: discovery ? `${provider.name} connected and reported ${provider.modelIds.length} models.` : `${provider.name} was configured with owner-supplied model IDs.`, source: 'provider' });
    addActivity('connection', discovery ? `${provider.name} connected and its current models were discovered.` : `${provider.name} was added with manually supplied models.`);
    await saveState();
    return json(res,201,{provider: safeProviderRecord(provider)});
  }
  const providerMatch = pathname.match(/^\/api\/providers\/([a-zA-Z0-9-]+)(?:\/(test|key))?$/);
  if (providerMatch) {
    const provider = state.providers.find(item => item.id === providerMatch[1]);
    if (!provider) return json(res,404,{error:'Provider not found.'});
    if (method === 'DELETE' && !providerMatch[2]) {
      const prefix = `provider:${provider.id}:`;
      if (state.settings.model.startsWith(prefix) || state.agents.some(item => item.model?.startsWith(prefix))) return json(res,409,{error:'Choose another model for agents and the default before removing this provider.'});
      if (!isOnDeviceProvider(provider)) await credentialVault.remove(provider.id);
      state.providers = state.providers.filter(item=>item.id!==provider.id);
      addReceipt({ action: `provider:${provider.id}:disconnect`, capability: 'network_read', risk: 'medium', status: 'completed', detail: `${provider.name} was disconnected and its protected credential was removed.`, source: 'provider' });
      addActivity('connection',`${provider.name} was disconnected and its saved credential removed.`);
      await saveState(); return json(res,200,{ok:true});
    }
    if (method === 'PUT' && providerMatch[2] === 'key') {
      if (isOnDeviceProvider(provider)) return json(res, 409, { error: 'On-device models do not use API keys.' });
      if (!isHostRequest(req)) return json(res,403,{error:'Update keys on the host computer.'});
      const body = await readBody(req);
      if (body.apiKey) await credentialVault.set(provider.id,body.apiKey); else await credentialVault.remove(provider.id);
      provider.hasKey = Boolean(body.apiKey);
      addReceipt({ action: `provider:${provider.id}:credential`, capability: 'network_read', risk: 'high', status: 'completed', detail: `${provider.name} protected credential was ${provider.hasKey ? 'replaced' : 'removed'}.`, source: 'provider' });
      addActivity('connection',`${provider.name} credential was ${provider.hasKey ? 'updated' : 'removed'}.`);
      await saveState(); return json(res,200,{provider: safeProviderRecord(provider)});
    }
    if (method === 'POST' && providerMatch[2] === 'test') {
      if (isOnDeviceProvider(provider)) return json(res, 200, { ok: true, message: `${provider.name} is configured for browser inference.`, models: provider.modelIds, receipt: state.receipts[0] });
      const secret = provider.hasKey ? await credentialVault.get(provider.id) : '';
      let response;
      try { response = await testProviderConnection(provider, secret); }
      catch (error) {
        provider.lastCheckedAt = now(); provider.lastError = error.message;
        addReceipt({ action: `provider:${provider.id}:test`, capability: 'network_read', risk: 'medium', status: 'failed', detail: error.message, source: 'provider' });
        addActivity('connection', `${provider.name} connection check failed.`); await saveState();
        return json(res,502,{error:error.message, receipt: state.receipts[0]});
      }
      if (response.models.length) provider.modelIds = response.models;
      provider.lastCheckedAt = now(); provider.lastError = '';
      addReceipt({ action: `provider:${provider.id}:test`, capability: 'network_read', risk: 'medium', status: 'completed', detail: response.message, source: 'provider' });
      addActivity('connection',`${provider.name} connection check returned HTTP ${response.status}${response.models.length ? ` and discovered ${response.models.length} model(s)` : ''}.`);
      await saveState();
      return json(res,200,{ok:true,message:`${response.message} Model generation is checked when you send a message.`, models: response.models, receipt: state.receipts[0]});
    }
  }
  const liveSpeechMatch = pathname.match(/^\/api\/live\/speech\/([a-z0-9-]+)$/);
  if (liveSpeechMatch && method === 'GET') {
    const clip = liveAudioClips.get(liveSpeechMatch[1]);
    if (!clip || clip.expiresAt < Date.now()) { liveAudioClips.delete(liveSpeechMatch[1]); return json(res, 404, { error: 'This temporary voice clip expired.' }); }
    res.writeHead(200, { ...securityHeaders(clip.mimeType), 'content-length': clip.bytes.length, 'cache-control': 'private, no-store', 'content-disposition': 'inline' });
    return res.end(clip.bytes);
  }
  if (pathname === '/api/live/speech' && method === 'POST') {
    const body = await readBody(req);
    const provider = state.providers.find((item) => item.id === cleanString(body.providerId));
    if (!provider || !provider.capabilities?.includes('speech')) return json(res, 400, { error: 'Choose a provider configured for speech generation.' });
    const model = cleanString(body.model).slice(0, 240);
    if (!model || !provider.modelIds.includes(model)) return json(res, 400, { error: 'Choose one of this provider’s configured speech models.' });
    const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability: 'generate_media', risk: provider.local ? 'low' : 'medium' });
    if (policy.decision === 'deny') return json(res, 403, { error: policy.reason, denied: true, policy });
    if (policy.decision === 'ask' && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy });
    try {
      const secret = provider.hasKey ? await credentialVault.get(provider.id) : '';
      const generated = await generateSpeechWithProvider(provider, secret, { model, voice: body.voice, text: body.text });
      for (const [expiredId, clip] of liveAudioClips) if (clip.expiresAt < Date.now()) liveAudioClips.delete(expiredId);
      while (liveAudioClips.size >= 20) liveAudioClips.delete(liveAudioClips.keys().next().value);
      const clipId = id('speech');
      liveAudioClips.set(clipId, { bytes: generated.bytes, mimeType: generated.mimeType, expiresAt: Date.now() + 10 * 60 * 1000 });
      addReceipt({ action: 'generate_speech', capability: 'generate_media', risk: provider.local ? 'low' : 'medium', status: 'completed', detail: `${provider.name} generated a local voice clip.`, source: 'provider' });
      addActivity('media', `A voice clip was generated with ${provider.name}.`); await saveState();
      return json(res, 201, { media: { id: clipId, type: 'audio', mimeType: generated.mimeType, model, voice: cleanString(body.voice).slice(0, 200), size: generated.bytes.length, url: `/api/live/speech/${clipId}`, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }, receipt: state.receipts[0] });
    } catch (error) { addReceipt({ action: 'generate_speech', capability: 'generate_media', risk: provider.local ? 'low' : 'medium', status: 'failed', detail: error.message, source: 'provider' }); await saveState(); return json(res, 502, { error: error.message }); }
  }
  if (pathname === '/api/live/realtime/call' && method === 'POST') {
    const body = await readBody(req);
    const provider = state.providers.find((item) => item.id === cleanString(body.providerId));
    if (!provider || !provider.enabled || !provider.capabilities?.includes('realtime')) return json(res, 400, { error: 'Choose a connected provider configured for realtime calling.' });
    const model = cleanString(body.model).slice(0, 240);
    if (!model || !provider.modelIds.includes(model)) return json(res, 400, { error: 'Choose one of this provider’s configured realtime models.' });
    const agent = findAgent(cleanString(body.agentId));
    if (!agent) return json(res, 404, { error: 'Choose an agent before starting the call.' });
    const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability: 'conversation', risk: 'medium' });
    if (policy.decision === 'deny') return json(res, 403, { error: policy.reason, denied: true, policy });
    if (policy.decision === 'ask' && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy });
    const instructions = [
      `You are ${agent.name}, speaking with the owner in a live voice call.`,
      agent.personality,
      agent.instructions,
      agent.rules,
      agent.useGlobalCommunication !== false ? compileCommunicationPrompt(state.settings.communicationGuide) : ''
    ].filter(Boolean).join('\n\n').slice(0, 12000);
    try {
      const secret = provider.hasKey ? await credentialVault.get(provider.id) : '';
      const result = await createRealtimeCall(provider, secret, { sdp: body.sdp, model, voice: body.voice, instructions });
      addReceipt({ action: 'realtime_call_start', capability: 'conversation', risk: 'medium', status: 'completed', detail: `${provider.name} started a realtime voice call for ${agent.name}.`, source: 'provider' });
      addActivity('media', `A realtime voice call started with ${agent.name}.`); await saveState();
      return json(res, 201, { answerSdp: result.answerSdp, receipt: state.receipts[0] });
    } catch (error) {
      addReceipt({ action: 'realtime_call_start', capability: 'conversation', risk: 'medium', status: 'failed', detail: error.message, source: 'provider' }); await saveState();
      return json(res, 502, { error: error.message });
    }
  }
  if (pathname === '/api/live/custom-voice' && method === 'POST') {
    const body = await readBody(req, 29 * 1024 * 1024);
    const provider = state.providers.find((item) => item.id === cleanString(body.providerId));
    if (!provider || !provider.enabled || !provider.capabilities?.includes('speech')) return json(res, 400, { error: 'Choose a connected speech provider first.' });
    const agent = findAgent(cleanString(body.agentId));
    if (!agent) return json(res, 404, { error: 'Choose an agent before creating a voice.' });
    const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability: 'generate_media', risk: 'high' });
    if (policy.decision === 'deny') return json(res, 403, { error: policy.reason, denied: true, policy });
    if (policy.decision === 'ask' && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy });
    try {
      const secret = provider.hasKey ? await credentialVault.get(provider.id) : '';
      const voice = await createCustomVoice(provider, secret, body);
      addReceipt({ action: 'custom_voice_create', capability: 'generate_media', risk: 'high', status: 'completed', detail: `${provider.name} created a consented custom voice for ${agent.name}. Audio was not stored by HexiGrid.`, source: 'provider' });
      addActivity('media', `A consented custom voice was created for ${agent.name}.`); await saveState();
      return json(res, 201, { voice, receipt: state.receipts[0] });
    } catch (error) {
      addReceipt({ action: 'custom_voice_create', capability: 'generate_media', risk: 'high', status: 'failed', detail: error.message, source: 'provider' }); await saveState();
      return json(res, 502, { error: error.message });
    }
  }
  if (pathname === '/api/media/images' && method === 'POST') {
    const body = await readBody(req);
    const provider = state.providers.find((item) => item.id === cleanString(body.providerId));
    if (!provider || !provider.capabilities?.includes('image')) return json(res, 400, { error: 'Choose a provider configured for image generation.' });
    const model = cleanString(body.model).slice(0, 240);
    const prompt = cleanString(body.prompt).slice(0, 12000);
    if (!model || !provider.modelIds.includes(model)) return json(res, 400, { error: 'Choose one of this provider’s configured image models.' });
    if (!prompt) return json(res, 400, { error: 'Describe the image you want to create.' });
    const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability: 'generate_media', risk: provider.local ? 'low' : 'medium' });
    if (policy.decision === 'deny') return json(res, 403, { error: policy.reason, denied: true, policy });
    if (policy.decision === 'ask' && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy });
    try {
      const secret = provider.hasKey ? await credentialVault.get(provider.id) : '';
      const generated = await generateImageWithProvider(provider, secret, model, prompt, { size: cleanString(body.size, '1024x1024') });
      const mediaId = id('media'); const extension = generated.mimeType === 'image/jpeg' ? '.jpg' : generated.mimeType === 'image/webp' ? '.webp' : '.png';
      const filename = `${mediaId}${extension}`;
      await fs.writeFile(path.join(MEDIA_DIR, filename), generated.bytes, { mode: 0o600 });
      const item = { id: mediaId, type: 'image', filename, mimeType: generated.mimeType, prompt, revisedPrompt: generated.revisedPrompt, model, providerId: provider.id, size: generated.bytes.length, createdAt: now() };
      state.media.unshift(item); state.media = state.media.slice(0, 500);
      addReceipt({ action: 'generate_image', capability: 'generate_media', risk: provider.local ? 'low' : 'medium', status: 'completed', detail: `${provider.name} generated ${filename}.`, source: 'provider' });
      addActivity('media', `An image was generated with ${provider.name}.`); await saveState();
      return json(res, 201, { media: { ...item, url: `/api/media/${item.id}` }, receipt: state.receipts[0] });
    } catch (error) { addReceipt({ action: 'generate_image', capability: 'generate_media', risk: provider.local ? 'low' : 'medium', status: 'failed', detail: error.message, source: 'provider' }); await saveState(); return json(res, 502, { error: error.message }); }
  }
  const mediaMatch = pathname.match(/^\/api\/media\/([a-z0-9-]+)$/);
  if (mediaMatch && method === 'GET') {
    const item = state.media.find((entry) => entry.id === mediaMatch[1]);
    if (!item) return json(res, 404, { error: 'Media not found.' });
    try { const filename = safeDataFilename(item.filename); const body = await fs.readFile(path.join(MEDIA_DIR, filename)); res.writeHead(200, { ...securityHeaders(item.mimeType), 'content-length': body.length, 'content-disposition': `inline; filename="${filename}"` }); return res.end(body); }
    catch { return json(res, 404, { error: 'The media file is missing from this device.' }); }
  }
  if (mediaMatch && method === 'DELETE') {
    const item = state.media.find((entry) => entry.id === mediaMatch[1]);
    if (!item) return json(res, 404, { error: 'Media not found.' });
    const body = await readBody(req); const denied = connectorPolicy('write_workspace', 'high', body.approved);
    if (denied) return json(res, denied.denied ? 403 : 409, denied);
    const filename = safeDataFilename(item.filename); await fs.rm(path.join(MEDIA_DIR, filename), { force: true }); state.media = state.media.filter((entry) => entry.id !== item.id); for (const agent of state.agents) if (agent.avatarModelId === item.id) agent.avatarModelId = ''; addActivity('media', `Removed ${filename}.`); await saveState(); return json(res, 200, { ok: true });
  }
  if (method === "GET" && pathname === "/api/bridge") return json(res, 200, bridgeStatus());
  if (method === "GET" && pathname === "/api/ilands/status") return json(res, 200, await officialRunnerStatus());
  if (method === 'GET' && pathname === '/api/ilands/profiles') {
    const profiles = await Promise.all((state.runnerProfiles || []).map(async (profile) => ({
      id: profile.id, label: profile.label, harness: profile.harness, agentId: profile.agentId || null,
      agentProfileId: profile.agentProfileId || null, createdAt: profile.createdAt,
      service: await runnerProfileStatus(profile), runtime: managedRunnerStatus(profile.id), job: publicRunnerJob(profile.id)
    })));
    return json(res, 200, { installed: bridgeStatus().runnerInstalled, runnerPath: bridgeStatus().runnerPath, supportedHarnesses: supportedRunnerHarnesses(), profiles });
  }
  if (method === 'POST' && pathname === '/api/ilands/profiles') {
    const body = await readBody(req);
    const label = cleanString(body.label).slice(0, 100);
    const harness = cleanString(body.harness, supportedRunnerHarnesses()[0]);
    if (!label) return json(res, 400, { error: 'Give this iLands account connection a recognizable name.' });
    if (!supportedRunnerHarnesses().includes(harness)) return json(res, 400, { error: `${harness || 'That harness'} is not certified for this operating system.` });
    const profileId = id('runner');
    const profile = { id: profileId, label, harness, home: path.join(RUNNER_PROFILE_DIR, profileId), agentId: null, agentProfileId: null, createdAt: now() };
    await fs.mkdir(profile.home, { recursive: true });
    state.runnerProfiles.push(profile); addActivity('connection', `${label} iLands connection was created locally.`); await saveState();
    return json(res, 201, { profile: { ...profile, home: undefined, runtime: managedRunnerStatus(profile.id) } });
  }
  if (method === 'POST' && pathname === '/api/ilands/install/plan') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Install Runner on the computer running HexiGrid.' });
    const body = await readBody(req);
    const denied = connectorPolicy('network_read', 'medium', body.approved);
    if (denied) return json(res, denied.denied ? 403 : 409, denied);
    try {
      const guide = await fetchIlandsGuide();
      const plan = createIlandsSetupPlan(guide, cleanString(body.harness));
      for (const [planId, existing] of ilandsSetupPlans) if (existing.consumedAt || Date.parse(existing.expiresAt) <= Date.now()) ilandsSetupPlans.delete(planId);
      ilandsSetupPlans.set(plan.id, plan);
      addReceipt({ action: 'ilands:installer-review', capability: 'network_read', risk: 'medium', status: 'completed', detail: `Verified iLands guide ${guide.guideDigest.slice(0, 12)}, release ${guide.release}, ${guide.platformKey}, ${plan.harness}. No installer code was executed.`, source: 'ilands-runner' });
      await saveState();
      return json(res, 200, { plan: publicIlandsSetupPlan(plan), message: 'The live iLands guide and certified platform branch were verified. Review this handoff before continuing.' });
    } catch (error) {
      addReceipt({ action: 'ilands:installer-review', capability: 'network_read', risk: 'medium', status: 'failed', detail: error.message, source: 'ilands-runner' }); await saveState();
      return json(res, 502, { error: error.message });
    }
  }
  if (method === 'POST' && pathname === '/api/ilands/install') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Prepare Runner setup on the computer running HexiGrid.' });
    const body = await readBody(req);
    const denied = connectorPolicy('external_write', 'high', body.approved);
    if (denied) return json(res, denied.denied ? 403 : 409, denied);
    const plan = ilandsSetupPlans.get(cleanString(body.planId));
    try {
      const currentGuide = await fetchIlandsGuide();
      verifyIlandsSetupPlan(plan, currentGuide, { guideDigest: cleanString(body.guideDigest), harness: cleanString(body.harness) });
      plan.consumedAt = now(); ilandsSetupPlans.delete(plan.id);
      const sourceName = plan.harness === 'codex' ? 'Codex' : plan.harness === 'claude-code' ? 'Claude Code' : plan.harness;
      const instruction = `Open https://ilands.ai/agent.md and connect this local ${sourceName} agent to iLands. Detect this machine's OS and architecture first, then follow only the certified ${plan.platformKey} branch and the ${plan.harness} Harness from live release ${plan.release}. Stop if the live guide changes or reports this target unsupported.`;
      addReceipt({ action: 'ilands:installer-handoff', capability: 'external_write', risk: 'high', status: 'completed', detail: `Created a single-use human/agent handoff for verified guide ${plan.guideDigest.slice(0, 12)}. HexiGrid executed no downloaded installer code.`, source: 'ilands-runner' });
      addActivity('connection', `A verified iLands ${plan.harness} setup handoff was prepared. Installation remains in the official interactive flow.`); await saveState();
      return json(res, 200, { launched: false, handoffRequired: true, instruction, guideUrl: 'https://ilands.ai/agent.md', release: plan.release, platformKey: plan.platformKey, harness: plan.harness, guideDigest: plan.guideDigest, message: process.platform === 'win32' ? 'Copy this instruction into the selected local agent. If iLands returns a bootstrap command, run that command yourself in ordinary Windows PowerShell. HexiGrid will never execute it for you.' : 'Copy this instruction into the selected local agent and follow the official user-scoped terminal prompts.' });
    } catch (error) {
      if (plan) ilandsSetupPlans.delete(plan.id);
      addReceipt({ action: 'ilands:installer-handoff', capability: 'external_write', risk: 'high', status: 'failed', detail: error.message, source: 'ilands-runner' }); await saveState();
      return json(res, 409, { error: error.message });
    }
  }
  const runnerProfileMatch = pathname.match(/^\/api\/ilands\/profiles\/([a-z0-9-]+)(?:\/(prepare|bind|start|stop))?$/);
  if (runnerProfileMatch) {
    const profile = findRunnerProfile(runnerProfileMatch[1]);
    if (!profile) return json(res, 404, { error: 'iLands connection not found.' });
    const action = runnerProfileMatch[2];
    if (method === 'GET' && !action) return json(res, 200, { profile: { id: profile.id, label: profile.label, harness: profile.harness, agentId: profile.agentId, agentProfileId: profile.agentProfileId, createdAt: profile.createdAt }, service: await runnerProfileStatus(profile), runtime: managedRunnerStatus(profile.id), job: publicRunnerJob(profile.id) });
    if (method === 'POST' && (action === 'prepare' || action === 'bind')) {
      const body = await readBody(req);
      const denied = connectorPolicy(action === 'bind' ? 'external_write' : 'run_tools', action === 'bind' ? 'high' : 'medium', body.approved);
      if (denied) return json(res, denied.denied ? 403 : 409, denied);
      try { const job = startRunnerJob(profile, action); addActivity('connection', `${profile.label} ${action === 'bind' ? 'connection approval' : 'harness check'} started.`); return json(res, 202, { job }); }
      catch (error) { return json(res, 409, { error: error.message }); }
    }
    if (method === 'POST' && action === 'start') {
      const body = await readBody(req); const denied = connectorPolicy('run_tools', 'medium', body.approved);
      if (denied) return json(res, denied.denied ? 403 : 409, denied);
      try { const runtime = startManagedRunner(profile); addActivity('connection', `${profile.label} Runner was started under HexiGrid supervision.`); return json(res, 200, { runtime }); }
      catch (error) { return json(res, 409, { error: error.message }); }
    }
    if (method === 'POST' && action === 'stop') {
      const stoppedJob = stopRunnerJob(profile.id);
      if (stoppedJob.stopped) addReceipt({ action: `runner:stop:${profile.id}`, capability: 'run_tools', risk: 'medium', status: 'cancelled', detail: `${profile.label} setup job was stopped by the owner.`, source: 'ilands-runner' });
      stopManagedRunner(profile.id); addActivity('connection', `${profile.label} Runner was stopped.`); return json(res, 200, { runtime: managedRunnerStatus(profile.id) });
    }
    if (method === 'DELETE' && !action) {
      const body = await readBody(req); const denied = connectorPolicy('write_workspace', 'high', body.approved);
      if (denied) return json(res, denied.denied ? 403 : 409, denied);
      const stoppedJob = stopRunnerJob(profile.id);
      if (stoppedJob.stopped) addReceipt({ action: `runner:stop:${profile.id}`, capability: 'run_tools', risk: 'medium', status: 'cancelled', detail: `${profile.label} setup job was stopped while the connection was removed.`, source: 'ilands-runner' });
      stopManagedRunner(profile.id);
      state.runnerProfiles = state.runnerProfiles.filter((item) => item.id !== profile.id);
      const agent = state.agents.find((item) => item.runnerProfileId === profile.id);
      if (agent) { agent.runnerProfileId = null; agent.status = 'disconnected'; }
      addActivity('connection', `${profile.label} connection metadata was removed. Runner credentials remain available for deliberate recovery or revocation.`); await saveState();
      return json(res, 200, { ok: true });
    }
  }
  const runnerJobMatch = pathname.match(/^\/api\/ilands\/jobs\/([a-z0-9-]+)$/);
  if (method === 'GET' && runnerJobMatch) {
    const profile = findRunnerProfile(runnerJobMatch[1]);
    if (!profile) return json(res, 404, { error: 'iLands connection not found.' });
    const job = publicRunnerJob(profile.id);
    if (!job) return json(res, 404, { error: 'No Runner setup job exists for this connection.' });
    await syncRunnerProfileFromJob(profile, job);
    return json(res, 200, { job, profile: { id: profile.id, label: profile.label, harness: profile.harness, agentId: profile.agentId, agentProfileId: profile.agentProfileId } });
  }
  if (method === "GET" && pathname === "/api/setup") return json(res, 200, setupGuide());
  if (method === "GET" && pathname === "/api/network") {
    const enabled = NETWORK_ENABLED;
    return json(res, 200, {
      enabled,
      secure: TLS_ENABLED,
      host: HOST,
      port: PORT,
      pairingCode: (enabled || quickTunnel.status().running) && isHostRequest(req) ? LAN_PAIR_CODE : null,
      urls: enabled ? lanAddresses().map((address) => `${SERVER_SCHEME}://${address}:${PORT}/`) : [],
      tunnel: quickTunnel.status()
    });
  }
  if (pathname === '/api/network/tunnel' && (method === 'POST' || method === 'DELETE')) {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Remote links can only be managed on the computer running HexiGrid.' });
    const body = await readBody(req);
    if (method === 'POST') {
      if (!state.settings.auth?.configured) return json(res, 409, { error: 'Create an owner passcode before opening a remote link.' });
      const denied = connectorPolicy('external_write', 'high', body.approved);
      if (denied) return json(res, denied.denied ? 403 : 409, denied);
      try {
        const tunnel = await quickTunnel.start(`http://127.0.0.1:${PORT}`);
        addReceipt({ action: 'remote-link:start', capability: 'external_write', risk: 'high', status: 'completed', detail: 'A temporary Cloudflare Quick Tunnel opened. Remote devices still require the rotating pairing code and owner sign-in.', source: 'network' });
        await saveState();
        return json(res, 200, { tunnel, pairingCode: LAN_PAIR_CODE });
      } catch (error) {
        addReceipt({ action: 'remote-link:start', capability: 'external_write', risk: 'high', status: 'failed', detail: error.message, source: 'network' });
        await saveState();
        return json(res, 502, { error: error.message, tunnel: quickTunnel.status() });
      }
    }
    quickTunnel.stop();
    addReceipt({ action: 'remote-link:stop', capability: 'external_write', risk: 'medium', status: 'completed', detail: 'The temporary remote link was closed.', source: 'network' });
    await saveState();
    return json(res, 200, { tunnel: quickTunnel.status() });
  }
  if (method === "GET" && pathname === "/api/models") return json(res, 200, { models: modelCatalog, selected: state.settings.model, policy: state.settings.modelPolicy, error: modelCatalogError });
  if (method === "POST" && pathname === "/api/models/refresh") {
    await refreshHarnessDetection();
    await refreshModelCatalog();
    return json(res, 200, { models: modelCatalog, selected: state.settings.model, policy: state.settings.modelPolicy, error: modelCatalogError });
  }
  if (method === 'GET' && pathname === '/api/harnesses') {
    await refreshHarnessDetection();
    return json(res, 200, { harnesses: detectedHarnesses.map((item) => ({ ...item, connected: state.harnessConnections.some((connection) => connection.id === item.id && connection.enabled !== false) })) });
  }
  const harnessMatch = pathname.match(/^\/api\/harnesses\/(opencode|claude-code|codex)$/);
  if (harnessMatch && method === 'POST') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Connect local command-line tools on the computer running HexiGrid.' });
    await refreshHarnessDetection();
    const status = detectedHarnesses.find((item) => item.id === harnessMatch[1]);
    if (!status?.installed) return json(res, 409, { error: `${status?.label || 'That tool'} is not installed on this computer.` });
    if (!status.authenticated) return json(res, 409, { error: `${status.label} is installed but not signed in. Sign in through that tool first, then scan again.` });
    const existing = state.harnessConnections.find((item) => item.id === status.id);
    if (existing) { existing.enabled = true; existing.connectedAt = now(); }
    else state.harnessConnections.push({ id: status.id, enabled: true, connectedAt: now() });
    await refreshModelCatalog();
    addActivity('connection', `${status.label} was connected by the user.`);
    await saveState();
    return json(res, 200, { harness: { ...status, connected: true }, models: modelCatalog });
  }
  if (harnessMatch && method === 'DELETE') {
    if (!isHostRequest(req)) return json(res, 403, { error: 'Disconnect local command-line tools on the computer running HexiGrid.' });
    const before = state.harnessConnections.length;
    state.harnessConnections = state.harnessConnections.filter((item) => item.id !== harnessMatch[1]);
    if (before === state.harnessConnections.length) return json(res, 404, { error: 'That tool is not connected.' });
    await refreshModelCatalog();
    addActivity('connection', 'A local command-line model connection was removed.');
    await saveState();
    return json(res, 200, { ok: true, models: modelCatalog });
  }

  if (method === "GET" && pathname === "/api/workspace/tree") {
    try {
      const requestedPath = cleanString(url.searchParams.get("path") || "").slice(0, 1000);
      const target = safeWorkspacePath(requestedPath);
      const stat = await fs.stat(target);
      if (!stat.isDirectory()) return json(res, 400, { error: "That path is not a folder." });
      return json(res, 200, { path: relativeWorkspacePath(target), entries: await workspaceEntries(requestedPath) });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (method === "GET" && pathname === "/api/workspace/file") {
    try {
      const requestedPath = cleanString(url.searchParams.get("path") || "").slice(0, 1000);
      const target = safeWorkspacePath(requestedPath);
      const stat = await fs.stat(target);
      if (!stat.isFile()) return json(res, 400, { error: "That path is not a file." });
      if (stat.size > 1024 * 1024) return json(res, 413, { error: "The built-in editor opens text files up to 1 MB." });
      return json(res, 200, { path: relativeWorkspacePath(target), content: await fs.readFile(target, "utf8"), size: stat.size });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (method === "PUT" && pathname === "/api/workspace/file") {
    const body = await readBody(req);
    const policy = evaluatePolicy({
      approvalPolicy: state.settings.approvalPolicy,
      workMode: state.settings.workMode,
      capability: "write_workspace",
      risk: "medium"
    });
    if (policy.decision === "deny") return json(res, 403, { error: policy.reason, denied: true, policy });
    if (policy.decision === "ask" && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy });
    try {
      const requestedPath = cleanString(body.path).slice(0, 1000);
      if (!requestedPath) return json(res, 400, { error: "Choose a file name first." });
      const content = typeof body.content === "string" ? body.content : "";
      if (Buffer.byteLength(content, "utf8") > 1024 * 1024) return json(res, 413, { error: "The built-in editor saves text files up to 1 MB." });
      const target = safeWorkspacePath(requestedPath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf8");
      addActivity("workspace", `Saved ${relativeWorkspacePath(target)} in the private workspace.`);
      await saveState();
      return json(res, 200, { ok: true, path: relativeWorkspacePath(target) });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (method === "POST" && pathname === "/api/workspace/command") {
    const body = await readBody(req);
    try {
      const result = await runWorkspaceCommand(body.command, body.approved === true);
      if (result.ok && !["help", "pwd", "ls", "dir", "cat", "type"].includes(splitCommand(body.command)[0]?.toLowerCase())) {
        addActivity("workspace", `Ran a workspace command: ${cleanString(body.command).slice(0, 80)}`);
        await saveState();
      }
      return json(res, result.denied ? 403 : result.approvalRequired ? 409 : result.ok ? 200 : 400, result);
    } catch (error) {
      return json(res, 400, { error: error.message, output: error.message });
    }
  }

  if (method === "POST" && pathname === "/api/communication/preview") {
    const body = await readBody(req);
    const message = cleanString(body.message, "Can you help me with this?").slice(0, 2000);
    const draftGuide = body.guide && typeof body.guide === "object" ? sanitizeCommunicationGuide(body.guide) : state.settings.communicationGuide;
    const prompt = [
      "You are previewing a communication style for the owner. Follow the communication guidance without inventing a larger task.",
      compileCommunicationPrompt(draftGuide),
      `Message: ${message}`,
      "Reply naturally and only with the response the user would receive."
    ].join("\n\n");
    try {
      const content = await askModel(prompt, cleanString(body.model, state.settings.model));
      return json(res, 200, { content, model: cleanString(body.model, state.settings.model) });
    } catch (error) {
      return json(res, 503, { error: error.message });
    }
  }

  if (method === "POST" && pathname === "/api/policy/evaluate") {
    const body = await readBody(req);
    return json(res, 200, evaluatePolicy({
      approvalPolicy: state.settings.approvalPolicy,
      workMode: state.settings.workMode,
      capability: cleanString(body.capability, "conversation"),
      risk: cleanString(body.risk, "medium")
    }));
  }

  if (method === 'POST' && pathname === '/api/live/email-receipt') {
    const body = await readBody(req);
    const action = ['send', 'invite', 'check'].includes(body.action) ? body.action : '';
    const receiptStatus = ['completed', 'failed'].includes(body.status) ? body.status : '';
    const agent = findAgent(cleanString(body.agentId));
    if (!action || !receiptStatus || !agent) return json(res, 400, { error: 'That agent email receipt is invalid.' });
    const receipt = addReceipt({
      agentId: agent.id,
      action: `agent_email:${action}`,
      capability: action === 'check' ? 'network_read' : 'external_write',
      risk: action === 'invite' ? 'medium' : 'low',
      status: receiptStatus,
      detail: receiptStatus === 'completed' ? `${action === 'check' ? 'Checked for mail from' : action === 'invite' ? 'Sent a temporary call invitation to' : 'Sent a message to'} ${agent.name} through the separately authorized Google Mail connection.` : `The ${action} email action for ${agent.name} failed.`,
      source: 'agent-email'
    });
    addActivity('agent-email', receiptStatus === 'completed' ? `${agent.name} email action completed.` : `${agent.name} email action failed.`);
    await saveState();
    return json(res, 201, { receipt });
  }

  if (pathname === "/api/agents" && method === "GET") return json(res, 200, { agents: state.agents });
  if (pathname === "/api/agents" && method === "POST") {
    const body = await readBody(req);
    const timestamp = now();
    const baseName = cleanString(body.name, `Agent ${state.agents.length + 1}`);
    const agent = {
      id: id(slug(baseName) || "agent"),
      name: baseName,
      accountLabel: cleanString(body.accountLabel, "New iLands account"),
      avatar: cleanString(body.avatar, baseName.slice(0, 1).toUpperCase()),
      avatarImage: cleanImageData(body.avatarImage),
      color: cleanString(body.color, "#8d7dff"),
      status: body.transport === "local-opencode" ? "local_ready" : "not_connected",
      transport: body.transport === "local-opencode" ? "local-opencode" : "ilands-runner",
      harness: body.harness === "claude-code" ? "claude-code" : "codex",
      ilandsAgentId: cleanString(body.ilandsAgentId),
      externalEmail: cleanEmail(body.externalEmail),
      runnerHome: cleanString(body.runnerHome),
      workspacePath: cleanString(body.workspacePath),
      personality: cleanString(body.personality),
      instructions: cleanString(body.instructions),
      rules: cleanString(body.rules),
      voiceProfile: sanitizeVoiceProfile(body.voiceProfile),
      model: allowedModel(cleanString(body.model))?.id || state.settings.model,
      useGlobalCommunication: body.useGlobalCommunication !== false,
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => cleanString(tag).slice(0, 30)).filter(Boolean).slice(0, 12) : [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    state.agents.push(agent);
    addActivity("agent", `${agent.name} was added to the control room.`);
    await saveState();
    return json(res, 201, { agent });
  }

  const duplicateMatch = pathname.match(/^\/api\/agents\/([^/]+)\/duplicate$/);
  if (duplicateMatch && method === "POST") {
    const source = findAgent(duplicateMatch[1]);
    if (!source) return json(res, 404, { error: "Agent not found." });
    const timestamp = now();
    const copy = { ...source, id: id("agent"), name: `${source.name} copy`, accountLabel: "New iLands account", ilandsAgentId: "", externalEmail: "", runnerHome: "", workspacePath: "", status: "not_connected", createdAt: timestamp, updatedAt: timestamp };
    state.agents.push(copy);
    addActivity("agent", `${source.name} profile was duplicated as ${copy.name}.`);
    await saveState();
    return json(res, 201, { agent: copy });
  }

  const memoryCollectionMatch = pathname.match(/^\/api\/agents\/([^/]+)\/memories$/);
  if (memoryCollectionMatch) {
    const target = findAgent(memoryCollectionMatch[1]);
    if (!target) return json(res, 404, { error: 'Agent not found.' });
    if (method === 'GET') return json(res, 200, { memories: state.memories.filter((memory) => memory.agentId === target.id) });
    if (method === 'POST') {
      const body = await readBody(req); const content = cleanString(body.content).slice(0, 4000);
      if (!content) return json(res, 400, { error: 'Memory text is empty.' });
      const memory = { id: id('memory'), agentId: target.id, category: cleanString(body.category, 'General').slice(0, 60), content, importance: Math.min(5, Math.max(1, Number(body.importance) || 3)), source: 'owner', createdAt: now(), updatedAt: now() };
      state.memories.unshift(memory); addActivity('memory', `A memory was added for ${target.name}.`); await saveState(); return json(res, 201, { memory });
    }
  }
  const memoryMatch = pathname.match(/^\/api\/memories\/([a-z0-9-]+)$/);
  if (memoryMatch) {
    const memory = state.memories.find((item) => item.id === memoryMatch[1]);
    if (!memory) return json(res, 404, { error: 'Memory not found.' });
    if (method === 'PATCH') {
      const body = await readBody(req); if (body.content !== undefined) memory.content = cleanString(body.content).slice(0, 4000); if (!memory.content) return json(res, 400, { error: 'Memory text is empty.' });
      if (body.category !== undefined) memory.category = cleanString(body.category, 'General').slice(0, 60); if (body.importance !== undefined) memory.importance = Math.min(5, Math.max(1, Number(body.importance) || 3)); memory.updatedAt = now(); await saveState(); return json(res, 200, { memory });
    }
    if (method === 'DELETE') { state.memories = state.memories.filter((item) => item.id !== memory.id); addActivity('memory', 'An owner-managed agent memory was removed.'); await saveState(); return json(res, 200, { ok: true }); }
  }

  const avatarModelMatch = pathname.match(/^\/api\/agents\/([^/]+)\/avatar-model$/);
  if (avatarModelMatch && method === 'POST') {
    const agent = findAgent(avatarModelMatch[1]);
    if (!agent) return json(res, 404, { error: 'Agent not found.' });
    const body = await readBody(req, 12 * 1024 * 1024);
    const policy = evaluatePolicy({ approvalPolicy: state.settings.approvalPolicy, workMode: state.settings.workMode, capability: 'conversation', risk: 'medium' });
    if (policy.decision === 'deny') return json(res, 403, { error: policy.reason, denied: true, policy });
    if (policy.decision === 'ask' && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy });
    try {
      const model = validateAvatarModelData(body.modelData);
      const mediaId = id('avatar-model'); const filename = `${mediaId}.glb`;
      await fs.writeFile(path.join(MEDIA_DIR, filename), model.bytes, { mode: 0o600, flag: 'wx' });
      const prior = state.media.find((item) => item.id === agent.avatarModelId && item.type === 'avatar-model');
      const item = { id: mediaId, type: 'avatar-model', filename, mimeType: model.mimeType, size: model.bytes.length, agentId: agent.id, createdAt: now() };
      state.media.unshift(item); agent.avatarModelId = mediaId; agent.updatedAt = now();
      if (prior) { await fs.rm(path.join(MEDIA_DIR, safeDataFilename(prior.filename)), { force: true }); state.media = state.media.filter((entry) => entry.id !== prior.id); }
      addReceipt({ action: 'avatar_model_save', capability: 'conversation', risk: 'medium', status: 'completed', detail: `A self-contained 3D avatar was saved locally for ${agent.name}.`, source: 'owner' }); await saveState();
      return json(res, 201, { agent: publicAgent(agent), receipt: state.receipts[0] });
    } catch (error) { return json(res, error.status || 400, { error: error.message }); }
  }
  if (avatarModelMatch && method === 'DELETE') {
    const agent = findAgent(avatarModelMatch[1]);
    if (!agent) return json(res, 404, { error: 'Agent not found.' });
    const body = await readBody(req); const denied = connectorPolicy('conversation', 'medium', body.approved);
    if (denied) return json(res, denied.denied ? 403 : 409, denied);
    const prior = state.media.find((item) => item.id === agent.avatarModelId && item.type === 'avatar-model');
    if (prior) await fs.rm(path.join(MEDIA_DIR, safeDataFilename(prior.filename)), { force: true });
    state.media = state.media.filter((entry) => entry.id !== agent.avatarModelId); agent.avatarModelId = ''; agent.updatedAt = now(); await saveState();
    return json(res, 200, { agent: publicAgent(agent) });
  }

  const agentMatch = pathname.match(/^\/api\/agents\/([^/]+)$/);
  if (agentMatch && method === "PATCH") {
    const agent = findAgent(agentMatch[1]);
    if (!agent) return json(res, 404, { error: "Agent not found." });
    const body = await readBody(req);
    const editable = ["name", "accountLabel", "avatar", "avatarImage", "color", "transport", "harness", "ilandsAgentId", "externalEmail", "runnerHome", "workspacePath", "personality", "instructions", "rules", "status", "tags", "model", "useGlobalCommunication", "voiceProfile"];
    for (const key of editable) {
      if (body[key] === undefined) continue;
      if (["name", "accountLabel", "avatar", "color", "ilandsAgentId", "runnerHome", "workspacePath", "personality", "instructions", "rules", "status"].includes(key)) agent[key] = cleanString(body[key]);
      if (key === 'externalEmail') agent.externalEmail = cleanEmail(body[key]);
      else if (key === "avatarImage") agent[key] = cleanImageData(body[key]);
      else if (key === "transport") agent[key] = body[key] === "local-opencode" ? "local-opencode" : "ilands-runner";
      else if (key === "harness") agent[key] = body[key] === "claude-code" ? "claude-code" : "codex";
      else if (key === "tags" && Array.isArray(body[key])) agent[key] = body[key].map((tag) => cleanString(tag).slice(0, 30)).filter(Boolean).slice(0, 12);
      else if (key === "model" && allowedModel(cleanString(body[key]))) agent[key] = cleanString(body[key]);
      else if (key === "useGlobalCommunication") agent[key] = body[key] !== false;
      else if (key === "voiceProfile" && body[key] && typeof body[key] === "object") agent[key] = sanitizeVoiceProfile(body[key]);
    }
    agent.updatedAt = now();
    if (agent.transport === "local-opencode") agent.status = "local_ready";
    addActivity("agent", `${agent.name} profile was updated.`);
    await saveState();
    return json(res, 200, { agent });
  }
  if (agentMatch && method === "DELETE") {
    const index = state.agents.findIndex((agent) => agent.id === agentMatch[1]);
    if (index === -1) return json(res, 404, { error: "Agent not found." });
    const [removed] = state.agents.splice(index, 1);
    for (const room of state.rooms) room.agentIds = room.agentIds.filter((agentId) => agentId !== removed.id);
    state.memories = state.memories.filter((memory) => memory.agentId !== removed.id);
    addActivity("agent", `${removed.name} was removed from the control room.`);
    await saveState();
    return json(res, 200, { ok: true });
  }

  if (pathname === '/api/tasks' && method === 'GET') return json(res, 200, { tasks: state.tasks, runs: state.taskRuns.slice(0, 200) });
  if (pathname === '/api/tasks' && method === 'POST') {
    const body = await readBody(req);
    const target = findAgent(cleanString(body.agentId));
    if (!target) return json(res, 400, { error: 'Choose an agent for this task.' });
    const prompt = cleanString(body.prompt).slice(0, 12000);
    if (!prompt) return json(res, 400, { error: 'Describe what the autonomous task should do.' });
    const task = {
      id: id('task'), name: cleanString(body.name, `Task ${state.tasks.length + 1}`).slice(0, 120), agentId: target.id,
      prompt, intervalSeconds: Math.min(86400, Math.max(0, Number(body.intervalSeconds) || 0)), maxRuns: Math.min(10000, Math.max(0, Number(body.maxRuns) || 1)), maxRetries: Math.min(10, Math.max(0, Number(body.maxRetries) || 0)),
      runCount: 0, retryCount: 0, status: 'paused', nextRunAt: null, lastOutput: '', lastError: '', createdAt: now(), updatedAt: now()
    };
    state.tasks.unshift(task); addReceipt({ action: `task:${task.id}:create`, capability: 'schedule', risk: 'medium', status: 'completed', detail: `${task.name} was created paused.`, source: 'task' }); addActivity('task', `${task.name} was created in paused state.`); await saveState();
    return json(res, 201, { task });
  }
  const taskMatch = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)(?:\/(run|cancel))?$/);
  if (taskMatch) {
    const task = state.tasks.find((item) => item.id === taskMatch[1]);
    if (!task) return json(res, 404, { error: 'Task not found.' });
    if (method === 'PATCH' && !taskMatch[2]) {
      const body = await readBody(req);
      if (body.name !== undefined) task.name = cleanString(body.name, task.name).slice(0, 120);
      if (body.prompt !== undefined) task.prompt = cleanString(body.prompt).slice(0, 12000);
      if (body.intervalSeconds !== undefined) task.intervalSeconds = Math.min(86400, Math.max(0, Number(body.intervalSeconds) || 0));
      if (body.maxRuns !== undefined) task.maxRuns = Math.min(10000, Math.max(0, Number(body.maxRuns) || 0));
      if (body.maxRetries !== undefined) task.maxRetries = Math.min(10, Math.max(0, Number(body.maxRetries) || 0));
      if (['paused', 'running', 'completed'].includes(body.status)) {
        if (body.status === 'running') {
          const policy = taskPolicy();
          if (policy.decision === 'deny') return json(res, 403, { error: policy.reason, denied: true, policy });
          if (policy.decision === 'ask' && body.approved !== true) return json(res, 409, { error: policy.reason, approvalRequired: true, policy });
          task.nextRunAt = null;
        }
        task.status = body.status;
      }
      if (['paused', 'running', 'completed'].includes(body.status)) addReceipt({ action: `task:${task.id}:${task.status}`, capability: 'schedule', risk: 'medium', status: 'completed', detail: `${task.name} was set to ${task.status}.`, source: 'task' });
      task.updatedAt = now(); await saveState(); return json(res, 200, { task });
    }
    if (method === 'POST' && taskMatch[2] === 'run') {
      const body = await readBody(req); const prior = task.status; task.status = 'running';
      const result = await runTaskOnce(task, body.approved === true);
      if (!result.ok && task.status === 'waiting_approval') task.status = prior === 'paused' ? 'paused' : task.status;
      await saveState(); return json(res, result.ok ? 200 : result.policy ? result.policy.decision === 'deny' ? 403 : 409 : 502, result);
    }
    if (method === 'POST' && taskMatch[2] === 'cancel') {
      task.status = 'cancelled'; task.nextRunAt = null; task.updatedAt = now(); activeTaskRuns.get(task.id)?.abort(); addReceipt({ action: `task:${task.id}:cancel`, capability: 'schedule', risk: 'medium', status: 'cancelled', detail: `${task.name} was cancelled by the owner.`, source: 'task' }); if (!activeTaskRuns.has(task.id)) addActivity('task', `${task.name} was cancelled.`); await saveState(); return json(res, 200, { task });
    }
  }

  if (pathname === "/api/rooms" && method === "GET") return json(res, 200, { rooms: state.rooms });
  if (pathname === "/api/rooms" && method === "POST") {
    const body = await readBody(req);
    const room = { id: id("room"), name: cleanString(body.name, "New room"), description: cleanString(body.description, ""), agentIds: [], messages: [], createdAt: now() };
    state.rooms.push(room);
    addActivity("room", `${room.name} was created.`);
    await saveState();
    return json(res, 201, { room });
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch && method === "PATCH") {
    const room = findRoom(roomMatch[1]);
    if (!room) return json(res, 404, { error: "Room not found." });
    const body = await readBody(req);
    if (body.name !== undefined) room.name = cleanString(body.name, room.name);
    if (body.description !== undefined) room.description = cleanString(body.description);
    if (Array.isArray(body.agentIds)) room.agentIds = body.agentIds.filter((agentId) => findAgent(agentId));
    await saveState();
    return json(res, 200, { room });
  }

  const browserMessageMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/messages\/browser$/);
  if (browserMessageMatch && method === 'POST') {
    const room = findRoom(browserMessageMatch[1]);
    if (!room) return json(res, 404, { error: 'Room not found.' });
    const body = await readBody(req);
    const agent = findAgent(cleanString(body.agentId));
    const route = agent ? allowedModel(agent.model) : null;
    if (!agent || !route?.browser) return json(res, 400, { error: 'Choose an agent assigned to an on-device browser model.' });
    if (!room.agentIds.includes(agent.id)) return json(res, 403, { error: 'That agent is not a participant in this room.' });
    const content = cleanString(body.content).slice(0, 20000);
    const failure = cleanString(body.error).slice(0, 800);
    if (!content && !failure) return json(res, 400, { error: 'The browser returned no reply.' });
    const message = failure
      ? { id: id('msg'), role: 'system', agentId: agent.id, author: agent.name, content: `On-device model unavailable: ${failure}`, transport: 'browser-webllm', delivery: 'local-only', createdAt: now() }
      : { id: id('msg'), role: 'agent', agentId: agent.id, author: agent.name, content, transport: 'browser-webllm', delivery: 'local-only', createdAt: now() };
    room.messages.push(message);
    room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
    addReceipt({ agentId: agent.id, action: `browser-model:${route.remoteModel}`, capability: 'conversation', risk: 'low', status: failure ? 'failed' : 'completed', detail: failure ? failure : `${agent.name} replied using a model running in the browser.`, source: 'browser-webllm' });
    if (!failure) {
      const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
      recordUsage({ agentId: agent.id, model: agent.model, inputTokens: count(body.inputTokens), outputTokens: count(body.outputTokens), inputText: body.inputText, outputText: content, source: 'browser-webllm' });
    }
    addActivity('chat', failure ? `${agent.name} could not answer with its browser model.` : `${agent.name} answered locally in the browser.`);
    await saveState();
    return json(res, 200, { room, message, receipt: state.receipts[0] });
  }

  if (pathname === '/api/usage/browser' && method === 'POST') {
    const body = await readBody(req);
    const route = allowedModel(cleanString(body.model));
    if (!route?.browser) return json(res, 400, { error: 'Choose an on-device browser model.' });
    const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
    recordUsage({
      model: route.id,
      inputTokens: count(body.inputTokens),
      outputTokens: count(body.outputTokens),
      inputText: body.inputText,
      outputText: body.outputText,
      source: 'browser-webllm'
    });
    addActivity('model', 'The local control assistant used a model running in this browser.');
    await saveState();
    return json(res, 200, { ok: true });
  }

  const userMessageMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/messages\/user$/);
  if (userMessageMatch && method === 'POST') {
    const room = findRoom(userMessageMatch[1]);
    if (!room) return json(res, 404, { error: 'Room not found.' });
    const body = await readBody(req);
    const content = cleanString(body.content).slice(0, 12000);
    if (!content) return json(res, 400, { error: 'Message is empty.' });
    const selectedIds = Array.isArray(body.agentIds) ? body.agentIds.filter((agentId) => findAgent(agentId)) : room.agentIds;
    if (!selectedIds.length) return json(res, 400, { error: 'Select at least one agent first.' });
    room.agentIds = selectedIds;
    room.messages.push({ id: id('msg'), role: 'user', author: 'You', content, createdAt: now() });
    room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
    addActivity('chat', `You sent a message to ${selectedIds.length} agent${selectedIds.length === 1 ? '' : 's'} in ${room.name}.`);
    await saveState();
    return json(res, 200, { room });
  }

  const messageMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/messages$/);
  if (messageMatch && method === "POST") {
    const room = findRoom(messageMatch[1]);
    if (!room) return json(res, 404, { error: "Room not found." });
    const body = await readBody(req);
    const content = cleanString(body.content);
    const includeUserMessage = body.includeUserMessage !== false;
    if (includeUserMessage && !content) return json(res, 400, { error: "Message is empty." });
    const selectedIds = Array.isArray(body.agentIds) ? body.agentIds.filter((agentId) => findAgent(agentId)) : room.agentIds;
    if (!selectedIds.length) return json(res, 400, { error: "Select at least one agent first." });
    room.agentIds = selectedIds;
    if (includeUserMessage) {
      const userMessage = { id: id("msg"), role: "user", author: "You", content, createdAt: now() };
      room.messages.push(userMessage);
      room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
      await saveState();
    }
    let recent = room.messages.slice(-18).map((message) => `${message.author || message.role}: ${message.content}`).join("\n");
    const replies = [];
    for (const agentId of selectedIds) {
      const agent = findAgent(agentId);
      const response = await respondForAgent(agent, recent, { approved: body.approved === true, source: 'room', imageDataUrl: typeof body.imageDataUrl === 'string' ? body.imageDataUrl.trim() : '' });
      const message = response.ok
        ? { id: id("msg"), role: "agent", agentId: agent.id, author: agent.name, content: response.content, transport: response.transport, delivery: response.delivery, connector: response.connector, createdAt: now() }
        : { id: id("msg"), role: "system", agentId: agent.id, author: agent.name, content: response.error, createdAt: now() };
      room.messages.push(message);
      replies.push(message);
      recent = `${recent}\n${message.author}: ${message.content}`;
    }
    room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
    addActivity("chat", `You sent a message to ${selectedIds.length} agent${selectedIds.length === 1 ? "" : "s"} in ${room.name}.`);
    await saveState();
    return json(res, 200, { room, replies });
  }

  if (pathname === '/api/live/transcripts' && method === 'GET') {
    return json(res, 200, { transcripts: (state.liveTranscripts || []).map(publicLiveTranscript) });
  }

  if (pathname === '/api/live/transcripts' && method === 'POST') {
    const body = await readBody(req, Math.min(MAX_BODY_BYTES, 4 * 1024 * 1024));
    const transcript = sanitizeLiveTranscript(body);
    if (!transcript.entries.length) return json(res, 400, { error: 'Save a live conversation before saving its transcript.' });
    const record = { id: id('transcript'), ...transcript };
    state.liveTranscripts = [record, ...(state.liveTranscripts || [])].slice(0, 100);
    addReceipt({ action: `live-transcript:${record.id}:save`, capability: 'write_local', risk: 'low', status: 'completed', detail: 'A live transcript was saved to the local control room.', source: 'live' });
    addActivity('communication', 'A live transcript was saved locally.');
    await saveState();
    return json(res, 201, { transcript: publicLiveTranscript(record), receipt: state.receipts[0] });
  }

  const liveTranscriptMatch = pathname.match(/^\/api\/live\/transcripts\/([a-z0-9-]+)$/);
  if (liveTranscriptMatch && method === 'DELETE') {
    const prior = state.liveTranscripts?.length || 0;
    state.liveTranscripts = (state.liveTranscripts || []).filter((item) => item.id !== liveTranscriptMatch[1]);
    if (state.liveTranscripts.length === prior) return json(res, 404, { error: 'Transcript not found.' });
    addReceipt({ action: `live-transcript:${liveTranscriptMatch[1]}:delete`, capability: 'write_local', risk: 'medium', status: 'completed', detail: 'A saved live transcript was deleted from local storage.', source: 'live' });
    await saveState();
    return json(res, 200, { ok: true });
  }

  if (pathname === "/api/settings" && method === "PATCH") {
    const body = await readBody(req);
    const priorModel = state.settings.model;
    const priorApproval = state.settings.approvalPolicy;
    const priorMode = state.settings.workMode;
    if (['free-only', 'all-models'].includes(body.modelPolicy)) state.settings.modelPolicy = body.modelPolicy;
    if (state.settings.modelPolicy === 'free-only' && !allowedModel(state.settings.model)) {
      state.settings.model = modelCatalog.find((model) => model.free)?.id || state.settings.model;
    }
    if (allowedModel(cleanString(body.model))) state.settings.model = cleanString(body.model);
    if (APPROVAL_PROFILES[body.approvalPolicy]) state.settings.approvalPolicy = body.approvalPolicy;
    if (WORK_MODES[body.workMode]) state.settings.workMode = body.workMode;
    if (body.activeGoal && typeof body.activeGoal === "object") {
      const title = cleanString(body.activeGoal.title).slice(0, 240);
      const requestedStatus = cleanString(body.activeGoal.status);
      state.settings.activeGoal = {
        title,
        status: title ? (["active", "complete", "paused"].includes(requestedStatus) ? requestedStatus : "active") : "idle",
        createdAt: title ? (state.settings.activeGoal?.createdAt || now()) : null
      };
    }
    if (body.subagents && typeof body.subagents === "object") {
      if (typeof body.subagents.enabled === "boolean") state.settings.subagents.enabled = body.subagents.enabled;
      if (Number.isInteger(body.subagents.maxConcurrent)) state.settings.subagents.maxConcurrent = Math.min(16, Math.max(1, body.subagents.maxConcurrent));
      state.settings.subagents.inheritPolicy = true;
    }
    if (body.communicationGuide && typeof body.communicationGuide === "object") {
      state.settings.communicationGuide = sanitizeCommunicationGuide(body.communicationGuide);
      state.settings.communicationGuide.updatedAt = now();
      addActivity("communication", "The global communication style was updated.");
    }
    if (body.owner && typeof body.owner === "object") {
      if (body.owner.displayName !== undefined) state.settings.owner.displayName = cleanString(body.owner.displayName, "Owner").slice(0, 80) || "Owner";
      if (body.owner.avatarImage !== undefined) state.settings.owner.avatarImage = cleanImageData(body.owner.avatarImage);
    }
    if (typeof body.autoStart === "boolean") state.settings.autoStart = body.autoStart;
    if (typeof body.setupAcknowledged === "boolean") state.settings.setupAcknowledged = body.setupAcknowledged;
    if (priorMode !== state.settings.workMode || priorApproval !== state.settings.approvalPolicy) {
      addActivity("policy", `Mode set to ${WORK_MODES[state.settings.workMode].label}; approval set to ${APPROVAL_PROFILES[state.settings.approvalPolicy].label}.`);
    }
    if (priorModel !== state.settings.model) addActivity("model", `The default model changed to ${modelLabel(state.settings.model)}.`);
    await saveState();
    return json(res, 200, { settings: publicSettings() });
  }

  if (pathname === "/api/assistant" && method === "POST") {
    const body = await readBody(req);
    const request = cleanString(body.content);
    if (!request) return json(res, 400, { error: "Assistant request is empty." });
    const context = state.agents.map((agent) => `${agent.name} | ${agent.accountLabel} | ${agent.transport} | ${agent.status}`).join("\n");
    const prompt = [
      "You are the local HexiGrid control assistant for a provider-neutral multi-agent dashboard.",
      "Help the owner reason about configuration and agent work. Do not claim to have changed files, connected accounts, or used tools unless a receipt is in context.",
      `Current model policy: ${state.settings.modelPolicy}, model ${state.settings.model}.`,
      `Current work mode: ${WORK_MODES[state.settings.workMode].label}.`,
      `Current approval profile: ${APPROVAL_PROFILES[state.settings.approvalPolicy].label}.`,
      compileCommunicationPrompt(state.settings.communicationGuide),
      state.settings.activeGoal?.title ? `Active goal: ${state.settings.activeGoal.title}.` : "No active goal.",
      `Agent inventory:\n${context || "No agents yet."}`,
      `Owner request:\n${request}`
    ].join("\n\n");
    try {
      const content = await askModel(prompt);
      recordUsage({ model: state.settings.model, inputText: prompt, outputText: content, source: "assistant" });
      addActivity("assistant", "The local control-room assistant answered a request.");
      await saveState();
      return json(res, 200, { content, model: state.settings.model });
    } catch (error) {
      return json(res, 503, { error: error.message, model: state.settings.model });
    }
  }

  if (await serveStaticAsset({ method, pathname, res, publicDir: PUBLIC_DIR, securityHeaders, serveHtml: html })) return;
  return json(res, 404, { error: "Not found." });
}

async function processExists(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; }
}

async function acquireInstanceLock() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const record = JSON.stringify({ product: 'hexigrid', version: APP_VERSION, instanceId: SERVER_INSTANCE_ID, pid: process.pid, createdAt: now() });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { await fs.writeFile(INSTANCE_LOCK_FILE, record, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); return; }
    catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      let existing = null;
      try { existing = JSON.parse(await fs.readFile(INSTANCE_LOCK_FILE, 'utf8')); } catch { /* malformed lock is stale */ }
      if (existing?.product === 'hexigrid' && await processExists(Number(existing.pid))) throw new Error(`Another HexiGrid process (${existing.pid}) is already using this private data folder.`);
      await fs.rm(INSTANCE_LOCK_FILE, { force: true });
    }
  }
  throw new Error('HexiGrid could not acquire its private data-folder lock.');
}

async function removeInstanceLock() {
  try {
    const record = JSON.parse(await fs.readFile(INSTANCE_LOCK_FILE, 'utf8'));
    if (record.instanceId === SERVER_INSTANCE_ID && Number(record.pid) === process.pid) await fs.rm(INSTANCE_LOCK_FILE, { force: true });
  } catch { /* absent, replaced, or unreadable lock */ }
}

await acquireInstanceLock();
if (DEVELOPMENT_FRESH_START) {
  await resetDevelopmentData(DATA_DIR);
  console.warn('HexiGrid development fresh-start is enabled. Private app data and browser preferences reset for every server session. Remove data/.development-fresh-start before release.');
}
await loadState();
if (!credentialVault.isAvailable() && !startupVaultWarningShown) {
  startupVaultWarningShown = true;
  console.warn('HexiGrid started in degraded credential mode: the operating-system credential vault is unavailable. Local encrypted data remains available, but API keys, OAuth credentials, plugin secrets, and MCP secrets are disabled until the vault is restored.');
}
if (startupReadOnly) console.warn('HexiGrid opened a preserved workspace in read-only recovery mode because its encrypted state key is unavailable. Restore the OS credential vault or import an encrypted backup before making changes.');
await refreshHarnessDetection();
await refreshModelCatalog();
async function loadTlsOptions() {
  if (!NETWORK_ENABLED) return null;
  if (TLS_PFX_PATH) {
    try {
      return { pfx: await fs.readFile(TLS_PFX_PATH), ...(TLS_PASSPHRASE ? { passphrase: TLS_PASSPHRASE } : {}) };
    } catch {
      throw new Error('Secure network mode could not read HEXIGRID_TLS_PFX. Check the file path and permissions.');
    }
  }
  if (TLS_CERT_PATH && TLS_KEY_PATH) {
    try {
      return {
        cert: await fs.readFile(TLS_CERT_PATH),
        key: await fs.readFile(TLS_KEY_PATH),
        ...(TLS_PASSPHRASE ? { passphrase: TLS_PASSPHRASE } : {})
      };
    } catch {
      throw new Error('Secure network mode could not read HEXIGRID_TLS_CERT or HEXIGRID_TLS_KEY. Check both paths and permissions.');
    }
  }
  throw new Error('Network access requires HTTPS. Set HEXIGRID_TLS_PFX, or both HEXIGRID_TLS_CERT and HEXIGRID_TLS_KEY, before starting with --network.');
}

const tlsOptions = await loadTlsOptions();
const requestHandler = (req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    json(res, error.status || 500, { error: error.status ? error.message : "Unexpected server error." });
  });
};
const server = tlsOptions ? https.createServer(tlsOptions, requestHandler) : http.createServer(requestHandler);

async function writeRuntimeIdentity() {
  const temporary = `${RUNTIME_FILE}.${process.pid}.tmp`;
  const record = JSON.stringify({ product: 'hexigrid', version: APP_VERSION, instanceId: SERVER_INSTANCE_ID, pid: process.pid, port: PORT, scheme: SERVER_SCHEME, startedAt: now() });
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(temporary, record, { encoding: 'utf8', mode: 0o600 });
  await fs.rm(RUNTIME_FILE, { force: true });
  await fs.rename(temporary, RUNTIME_FILE);
}

async function removeRuntimeIdentity() {
  try { const record = JSON.parse(await fs.readFile(RUNTIME_FILE, 'utf8')); if (record.instanceId === SERVER_INSTANCE_ID && Number(record.pid) === process.pid) await fs.rm(RUNTIME_FILE, { force: true }); }
  catch { /* absent, replaced, or unreadable runtime identity */ }
}

server.listen(PORT, HOST, async () => {
  try { await writeRuntimeIdentity(); }
  catch { console.error('HexiGrid could not create its local runtime identity file.'); server.close(async () => { await removeInstanceLock(); process.exit(1); }); return; }
  console.log(`HexiGrid listening at ${SERVER_SCHEME}://${HOST}:${PORT}`);
  console.log(`Model policy: ${state.settings.modelPolicy} (${state.settings.model || 'no model available'})`);
  if (NETWORK_ENABLED) for (const address of lanAddresses()) console.log(`Secure network address: https://${address}:${PORT}/`);
});
startTaskWorker();

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const controller of activeTaskRuns.values()) controller.abort();
  stopAllRunnerJobs();
  stopAllManagedRunners();
  quickTunnel.stop();
  server.close(async () => { await removeRuntimeIdentity(); await removeInstanceLock(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref?.();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
