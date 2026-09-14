import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { agentInterfaceManifest } from '../lib/agent-interface.mjs';

test('agent interface manifest is versioned, predictable, and has no permission bypass', () => {
  const manifest = agentInterfaceManifest({ version: '0.0.1' });
  assert.equal(manifest.schemaVersion, '1.0');
  assert.equal(manifest.presentation.agent, '/agent-interface.html');
  assert.equal(manifest.security.authenticationRequired, true);
  assert.equal(manifest.security.permissionBypassAvailable, false);
  assert.equal(manifest.actions.sendRoomMessage.method, 'POST');
  assert.match(JSON.stringify(manifest), /Never request, display, log/);
  assert.doesNotMatch(JSON.stringify(manifest), /apiKey|passwordHash|recoveryHash|cookieValue/);
});

test('human and agent interfaces link to each other and agent assets are served and cached', async () => {
  const [human, agent, staticAssets, worker] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/agent-interface.html', import.meta.url), 'utf8'),
    readFile(new URL('../lib/static-assets.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  ]);
  assert.match(human, /href="\/agent-interface\.html"/);
  assert.match(agent, /href="\/"[^>]*>Human interface/);
  assert.match(agent, /href="\/api\/agent-interface"/);
  assert.match(agent, /id="agentUnlockForm"/);
  assert.match(agent, /processed on this device and is not sent to an AI provider/);
  for (const asset of ['/agent-interface.html', '/agent-interface.js', '/agent-interface.css']) {
    assert.match(`${staticAssets}\n${worker}`, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
