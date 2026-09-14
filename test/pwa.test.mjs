import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicRoot = path.join(root, 'public');
const expected = new Map([
  ['/icon-192.png', [192, 192, 'any']],
  ['/icon-512.png', [512, 512, 'any']],
  ['/icon-maskable-192.png', [192, 192, 'maskable']],
  ['/icon-maskable-512.png', [512, 512, 'maskable']]
]);

async function pngDimensions(file) {
  const bytes = await readFile(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137,80,78,71,13,10,26,10], `${file} must be a PNG`);
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test('PWA manifest has complete any-purpose and dedicated maskable raster icons', async () => {
  const manifest = JSON.parse(await readFile(path.join(publicRoot, 'manifest.webmanifest'), 'utf8'));
  for (const field of ['name', 'short_name', 'description', 'id', 'start_url', 'scope', 'display', 'theme_color', 'background_color']) assert.ok(manifest[field], `${field} is required`);
  assert.equal(manifest.start_url, '/'); assert.equal(manifest.scope, '/'); assert.equal(manifest.display, 'standalone');
  for (const [src, [width, height, purpose]] of expected) {
    const icon = manifest.icons.find((item) => item.src === src && item.purpose === purpose);
    assert.ok(icon, `${src} (${purpose}) must be declared`);
    assert.equal(icon.type, 'image/png'); assert.equal(icon.sizes, `${width}x${height}`);
    assert.deepEqual(await pngDimensions(path.join(publicRoot, src.slice(1))), [width, height]);
  }
});

test('iOS icons, splash screens, and offline shell assets are present and wired', async () => {
  const [html, worker] = await Promise.all([readFile(path.join(publicRoot, 'index.html'), 'utf8'), readFile(path.join(publicRoot, 'sw.js'), 'utf8')]);
  assert.match(html, /rel="apple-touch-icon"[^>]+apple-touch-icon-180\.png/);
  assert.match(html, /rel="apple-touch-startup-image"[^>]+splash-1170x2532\.png/);
  assert.match(html, /rel="apple-touch-startup-image"[^>]+splash-2048x2732\.png/);
  assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="theme-color" content="#090b10"/);
  assert.deepEqual(await pngDimensions(path.join(publicRoot, 'apple-touch-icon-180.png')), [180, 180]);
  assert.deepEqual(await pngDimensions(path.join(publicRoot, 'splash-1170x2532.png')), [1170, 2532]);
  assert.deepEqual(await pngDimensions(path.join(publicRoot, 'splash-2048x2732.png')), [2048, 2732]);
  for (const asset of [...expected.keys(), '/apple-touch-icon-180.png', '/splash-1170x2532.png', '/splash-2048x2732.png']) {
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok((await stat(path.join(publicRoot, asset.slice(1)))).size > 1000);
  }
  assert.match(worker, /request\.mode === "navigate" \? caches\.match\("\/"\)/);
});

test('PWA install prompt is user-triggered and service worker registration is capability-gated', async () => {
  const app = await readFile(path.join(publicRoot, 'app.js'), 'utf8');
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /data-action="install-pwa"|action === "install-pwa"/);
  assert.match(app, /"serviceWorker" in navigator/);
  assert.match(app, /beforeinstallprompt[\s\S]{0,180}preventDefault\(\)[\s\S]{0,180}deferredInstallPrompt/);
});

test('on-device browser inference is lazy, worker-backed, and included in the offline shell', async () => {
  const [html, inference, worker, serviceWorker, staticAssets] = await Promise.all([
    readFile(path.join(publicRoot, 'index.html'), 'utf8'),
    readFile(path.join(publicRoot, 'on-device-inference.js'), 'utf8'),
    readFile(path.join(publicRoot, 'on-device-worker.js'), 'utf8'),
    readFile(path.join(publicRoot, 'sw.js'), 'utf8'),
    readFile(path.join(root, 'lib', 'static-assets.mjs'), 'utf8')
  ]);
  assert.match(html, /src="\/on-device-inference\.js"/);
  assert.match(html, /src="\/on-device-chat\.js"/);
  assert.match(inference, /navigator\.gpu/);
  assert.match(inference, /new Worker\('\/on-device-worker\.js'/);
  assert.match(inference, /import\('\/vendor\/web-llm\.js'\)/);
  assert.match(worker, /WebWorkerMLCEngineHandler/);
  assert.match(serviceWorker, /"\/on-device-inference\.js"/);
  assert.match(serviceWorker, /"\/on-device-chat\.js"/);
  assert.match(serviceWorker, /"\/vendor\/web-llm\.js"/);
  assert.match(staticAssets, /'\/vendor\/web-llm\.js'/);
  assert.ok((await stat(path.join(publicRoot, 'vendor', 'web-llm.js'))).size > 1000000);
});
