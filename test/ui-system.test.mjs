import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = (file) => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('theme picker has four plain names with no marketing subtitles', async () => {
  const html = await read('public/index.html');
  const cards = [...html.matchAll(/<button\s+class="theme-card"[\s\S]*?<strong>([^<]+)<\/strong>([\s\S]*?)<\/button\s*>/g)];
  assert.deepEqual(cards.map((match) => match[1]), ['Dark', 'Light', 'Prism', 'Parchment']);
  assert.ok(cards.every((match) => !/<small\b/.test(match[2])));
});

test('button interaction module is optional-audio safe and cached with the app shell', async () => {
  const [html, source, serviceWorker, staticAssets, styles] = await Promise.all([
    read('public/index.html'), read('public/interactions.js'), read('public/sw.js'), read('lib/static-assets.mjs'), read('public/interactions.css')
  ]);
  assert.match(html, /src="\/interactions\.js"/);
  assert.match(html, /id="buttonSoundsEnabled"[^>]*checked/);
  assert.match(source, /localStorage\.getItem\(STORAGE_KEY\) !== 'off'/);
  assert.match(source, /window\.AudioContext \|\| window\.webkitAudioContext/);
  assert.match(source, /audioContext\.resume\(\)\.then/);
  assert.match(source, /catch \{[\s\S]*never interrupt the button action/);
  assert.match(source, /pointerdown/);
  assert.match(styles, /hexButtonRelease/);
  assert.match(styles, /@media\(hover:hover\) and \(pointer:fine\)/);
  assert.match(serviceWorker, /"\/interactions\.js"/);
  assert.match(staticAssets, /'\/interactions\.js'/);
});

test('boot layer, modular features, and guide links are wired together', async () => {
  const [html, bootLayer, brandMotion, guides, guideUi] = await Promise.all([
    read('public/index.html'), read('public/boot-layer.css'), read('public/brand-motion.css'), read('public/guide-content.js'), read('public/guide-ui.js')
  ]);
  for (const module of ['agent-ui', 'chat-ui', 'on-device-chat', 'communication-ui', 'workspace-ui', 'guide-ui', 'providers', 'harnesses', 'control-shell', 'task-ui', 'plugin-ui', 'backup-ui', 'auth-ui', 'google-backup', 'integrations', 'interactions']) {
    assert.match(html, new RegExp(`src="/${module}\\.js"`));
  }
  assert.match(bootLayer, /body\.booting>\.app-shell/);
  assert.match(bootLayer, /body\.booting>\.auth-gate/);
  assert.match(brandMotion, /brandSweep/);
  assert.match(brandMotion, /mask:url\("\/hexigrid-mark\.svg"\)/);
  for (const key of [...html.matchAll(/data-guide="([^"]+)"/g)].map((match) => match[1])) {
    assert.match(guides, new RegExp(`\\b${key}: topic\\(`), `missing guide topic: ${key}`);
  }
  for (const topic of ['openai', 'anthropic', 'gemini', 'huggingface', 'ollama', 'lmstudio', 'cli', 'ilands', 'tools', 'backup']) {
    assert.match(guides, new RegExp(`${topic}: topic\\([\\s\\S]*?officialLinks:`), `missing official links for ${topic}`);
  }
  assert.match(guideUi, /Official source/);
});

test('development browser reset is server-controlled and limited to HexiGrid preferences', async () => {
  const source = await read('public/app.js');
  assert.match(source, /identity\.developmentFreshStart/);
  assert.match(source, /key\.startsWith\('hexigrid-'\) \|\| key\.startsWith\('aveniq-'\)/);
  assert.doesNotMatch(source, /localStorage\.clear\(\)|sessionStorage\.clear\(\)/);
});

test('a truly empty first launch has a usable chat-room empty state', async () => {
  const source = await read('public/chat-ui.js');
  assert.match(source, /No chat room yet/);
  assert.match(source, /Create a room first/);
  assert.match(source, /input\.disabled = true/);
  assert.match(source, /input\.disabled = false/);
});

test('passcode setup hides onboarding until local authentication is complete', async () => {
  const [auth, app] = await Promise.all([read('public/auth-ui.js'), read('public/app.js')]);
  assert.match(auth, /querySelector\('#onboarding'\)\?\.classList\.add\('hidden'\)/);
  assert.match(app, /\$\("#authGate"\)\.classList\.contains\("hidden"\)/);
  assert.match(auth, /api\('\/api\/auth\/status'\)[\s\S]*await window\.hexigridGoogleReady/);
  assert.match(app, /window\.hexigridAuthInitialized/);
});

test('Google setup is one click and never asks an end user for developer credentials', async () => {
  const [html, google, firebaseClient, server] = await Promise.all([read('public/index.html'), read('public/google-backup.js'), read('client/firebase-google.js'), read('server.mjs')]);
  assert.match(html, /Continue with Google/);
  assert.match(html, /src="\/vendor\/firebase-google\.js"/);
  assert.match(google, /HexiGridGoogle\.connect/);
  assert.match(google, /\/api\/auth\/google\/firebase/);
  assert.doesNotMatch(html, /data-action="onboarding-google"/);
  assert.match(html, /id="googleSummaryBadge"/);
  assert.match(google, /function setGoogleAccount/);
  assert.match(firebaseClient, /auth\.currentUser && !force/);
  assert.match(firebaseClient, /connect\(\{ force: true \}\)/);
  assert.doesNotMatch(`${html}\n${google}\n${server}`, /googleClientId|Desktop OAuth client|api\/sync\/google/);
});

test('boot artwork uses modular particles, a healing veil, and a compositor-safe unlock', async () => {
  const [html, styles, environment, particles, veil, loader, interactions, worker, staticAssets] = await Promise.all([
    read('public/index.html'),
    read('public/boot-loader.css'),
    read('public/boot-environment.js'),
    read('public/boot-particles.js'),
    read('public/boot-veil.js'),
    read('public/boot-loader.js'),
    read('public/interactions.js'),
    read('public/sw.js'),
    read('lib/static-assets.mjs')
  ]);
  assert.match(html, /id="bootEnvironment"/);
  assert.doesNotMatch(html, /id="bootVeil"/);
  assert.match(html, /boot-particles\.js[\s\S]*boot-veil\.js[\s\S]*boot-environment\.js/);
  assert.match(styles, /\.boot-environment\{[^}]*inset:0[^}]*width:100%[^}]*height:100%/);
  assert.match(styles, /\.boot-environment\{[^}]*opacity:\.82/);
  assert.match(styles, /\.boot-hologram\{[^}]*width:min\(76vmin,720px\)/);
  assert.match(styles, /\.boot-loader\.opening \.boot-hologram\{[^}]*opacity:1[^}]*scale\(1\.04\)/);
  assert.match(styles, /\.boot-loader\.departing \.boot-hologram\{[^}]*scale\(4\.8\)/);
  assert.match(styles, /\.boot-loader\.departing \.boot-environment\{opacity:0\}/);
  assert.match(environment, /HexiGridParticleField/);
  assert.match(environment, /HexiGridRevealVeil/);
  assert.match(environment, /const maxLength = coarsePointer \? 110 : 150/);
  assert.match(environment, /tailBias/);
  assert.match(environment, /healingRate/);
  assert.match(environment, /function move\(event\) \{\s+if \(reduced\) return;/);
  assert.match(environment, /now - motionAt < 110/);
  assert.match(environment, /const healingRate = \(moving \? \.55 : \.8\) \+ tailBias \* 1\.25/);
  assert.match(environment, /frameInterval/);
  assert.match(environment, /addEventListener\('pointermove'/);
  assert.match(environment, /addEventListener\('pointerdown'/);
  assert.match(particles, /HexiGridParticleField/);
  assert.match(particles, /document\.createElement\('canvas'\)/);
  assert.match(particles, /const PHI/);
  assert.match(particles, /Math\.pow\(1 - distance \/ influence, 2\)/);
  assert.match(particles, /particle\.bloom/);
  assert.match(particles, /1152 \/ width/);
  assert.doesNotMatch(particles, /drawHexagon|drawDoubleHexagon/);
  assert.match(veil, /HexiGridRevealVeil/);
  assert.match(veil, /destination-out/);
  assert.match(veil, /destination-over/);
  assert.match(veil, /drawImage\(source, x, y, regionWidth, regionHeight/);
  assert.match(veil, /lineCap = 'round'/);
  assert.match(veil, /paint\(union\(previousBounds, currentBounds\)\)/);
  assert.match(veil, /Math\.pow\(\(from\.life \+ to\.life\) \/ 2, \.72\)/);
  assert.match(veil, /function segmentPath/);
  assert.match(veil, /const REVEAL_SCALE = 2\.5/);
  assert.match(veil, /paint\(\{ x: 0, y: 0, width, height \}\)/);
  assert.match(veil, /surface\.addColorStop\(0, '#41d3ec'\)/);
  assert.match(veil, /const baseCanvas = document\.createElement\('canvas'\)/);
  assert.match(veil, /clearRect\(x, y, regionWidth, regionHeight\)/);
  assert.match(veil, /globalCompositeOperation = 'source-over'/);
  assert.doesNotMatch(veil, /globalCompositeOperation = 'copy'/);
  assert.match(veil, /drawImage\(baseCanvas, x, y, regionWidth, regionHeight/);
  assert.match(loader, /strokeText\('CLICK TO ENTER'/);
  assert.match(loader, /devicePixelRatio \|\| 1, 1\.1/);
  assert.match(loader, /frameInterval/);
  assert.match(loader, /loader\.classList\.add\('opening'\)/);
  assert.match(loader, /const FACET_STEP_MS = 102/);
  assert.match(loader, /const FACET_MOVE_MS = 310/);
  assert.match(loader, /const OUTER_UNLOCK_MS = FACET_STEP_MS \* \(faces\.length - 1\) \+ FACET_MOVE_MS/);
  assert.match(loader, /outerUnlockRank\[item\.faceIndex\] \* FACET_STEP_MS/);
  assert.match(loader, /smoothstep\(unlockElapsed \/ OUTER_UNLOCK_MS\)/);
  assert.match(loader, /smoothstep\(\(unlockElapsed - OUTER_UNLOCK_MS\) \/ CORE_RADIANCE_MS\)/);
  assert.match(loader, /const reactorHeat = reduced \? unlock : smoothstep\(unlockElapsed \/ OUTER_UNLOCK_MS\)/);
  assert.match(loader, /playFacetSequence\?\.\(\{ count: faces\.length, stepMs: FACET_STEP_MS \}\)/);
  assert.match(interactions, /function playFacetSequence/);
  assert.match(interactions, /firstTick \+ index \* stepMs \/ 1000/);
  assert.match(interactions, /if \(!soundsEnabled\(\)\) return/);
  assert.match(loader, /function drawInnerRadiance/);
  assert.match(loader, /drawMesh\(size, \.39,[^\n]+, 0, elapsed, true, instability\)/);
  assert.match(loader, /setTimeout\(\(\) => loader\.classList\.add\('departing'\), OUTER_UNLOCK_MS \+ CORE_RADIANCE_MS \* \.76\)/);
  assert.match(styles, /24%\{opacity:\.5\}/);
  assert.match(loader, /document\.hidden/);
  assert.match(loader, /Math\.min\(width, height\)/);
  assert.match(loader, /render\(performance\.now\(\)\)/);
  assert.doesNotMatch(loader, /drawUnlockFlash/);
  for (const asset of ['/boot-particles.js', '/boot-veil.js']) {
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(staticAssets, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
