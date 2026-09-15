import { promises as fs } from 'node:fs';
import path from 'node:path';

const STATIC_ASSETS = new Map([
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/agent-interface.js', ['agent-interface.js', 'text/javascript; charset=utf-8']],
  ['/agent-interface.css', ['agent-interface.css', 'text/css; charset=utf-8']],
  ['/providers.js', ['providers.js', 'text/javascript; charset=utf-8']],
  ['/icons.js', ['icons.js', 'text/javascript; charset=utf-8']],
  ['/guide-content.js', ['guide-content.js', 'text/javascript; charset=utf-8']],
  ['/agent-ui.js', ['agent-ui.js', 'text/javascript; charset=utf-8']],
  ['/chat-ui.js', ['chat-ui.js', 'text/javascript; charset=utf-8']],
  ['/communication-ui.js', ['communication-ui.js', 'text/javascript; charset=utf-8']],
  ['/workspace-ui.js', ['workspace-ui.js', 'text/javascript; charset=utf-8']],
  ['/guide-ui.js', ['guide-ui.js', 'text/javascript; charset=utf-8']],
  ['/harnesses.js', ['harnesses.js', 'text/javascript; charset=utf-8']],
  ['/control-shell.js', ['control-shell.js', 'text/javascript; charset=utf-8']],
  ['/task-ui.js', ['task-ui.js', 'text/javascript; charset=utf-8']],
  ['/plugin-ui.js', ['plugin-ui.js', 'text/javascript; charset=utf-8']],
  ['/backup-ui.js', ['backup-ui.js', 'text/javascript; charset=utf-8']],
  ['/auth-ui.js', ['auth-ui.js', 'text/javascript; charset=utf-8']],
  ['/live-voice.js', ['live-voice.js', 'text/javascript; charset=utf-8']],
  ['/live-recording.js', ['live-recording.js', 'text/javascript; charset=utf-8']],
  ['/live-generated-voice.js', ['live-generated-voice.js', 'text/javascript; charset=utf-8']],
  ['/live-call.js', ['live-call.js', 'text/javascript; charset=utf-8']],
  ['/live-realtime.js', ['live-realtime.js', 'text/javascript; charset=utf-8']],
  ['/avatar-viewer.js', ['avatar-viewer.js', 'text/javascript; charset=utf-8']],
  ['/vendor/model-viewer.js', ['vendor/model-viewer.js', 'text/javascript; charset=utf-8']],
  ['/google-backup.js', ['google-backup.js', 'text/javascript; charset=utf-8']],
  ['/boot-loader.js', ['boot-loader.js', 'text/javascript; charset=utf-8']],
  ['/boot-particles.js', ['boot-particles.js', 'text/javascript; charset=utf-8']],
  ['/boot-veil.js', ['boot-veil.js', 'text/javascript; charset=utf-8']],
  ['/boot-environment.js', ['boot-environment.js', 'text/javascript; charset=utf-8']],
  ['/interactions.js', ['interactions.js', 'text/javascript; charset=utf-8']],
  ['/integrations.js', ['integrations.js', 'text/javascript; charset=utf-8']],
  ['/on-device-inference.js', ['on-device-inference.js', 'text/javascript; charset=utf-8']],
  ['/on-device-chat.js', ['on-device-chat.js', 'text/javascript; charset=utf-8']],
  ['/on-device-worker.js', ['on-device-worker.js', 'text/javascript; charset=utf-8']],
  ['/vendor/web-llm.js', ['vendor/web-llm.js', 'text/javascript; charset=utf-8']],
  ['/vendor/firebase-google.js', ['vendor/firebase-google.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/boot-loader.css', ['boot-loader.css', 'text/css; charset=utf-8']],
  ['/pairing.css', ['pairing.css', 'text/css; charset=utf-8']],
  ['/status.css', ['status.css', 'text/css; charset=utf-8']],
  ['/identity.css', ['identity.css', 'text/css; charset=utf-8']],
  ['/brand-motion.css', ['brand-motion.css', 'text/css; charset=utf-8']],
  ['/browser-crypto.js', ['browser-crypto.js', 'text/javascript; charset=utf-8']],
  ['/browser-vault.js', ['browser-vault.js', 'text/javascript; charset=utf-8']],
  ['/browser-providers.js', ['browser-providers.js', 'text/javascript; charset=utf-8']],
  ['/standalone-runtime.js', ['standalone-runtime.js', 'text/javascript; charset=utf-8']],
  ['/interactions.css', ['interactions.css', 'text/css; charset=utf-8']],
  ['/live-communication.css', ['live-communication.css', 'text/css; charset=utf-8']],
  ['/boot-layer.css', ['boot-layer.css', 'text/css; charset=utf-8']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json; charset=utf-8']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8', { 'cache-control': 'no-cache' }]],
  ['/icon.svg', ['icon.svg', 'image/svg+xml; charset=utf-8']],
  ['/hexigrid-mark.svg', ['hexigrid-mark.svg', 'image/svg+xml; charset=utf-8']]
]);

const PNG_ASSET = /^\/(?:icon-(?:192|512)|icon-maskable-(?:192|512)|apple-touch-icon-180|splash-(?:1170x2532|2048x2732))\.png$/;

async function sendFile({ res, publicDir, filename, contentType, headers, securityHeaders }) {
  const body = await fs.readFile(path.join(publicDir, filename));
  res.writeHead(200, { ...securityHeaders(contentType), ...headers });
  res.end(body);
}

export async function serveStaticAsset({ method, pathname, res, publicDir, securityHeaders, serveHtml }) {
  if (method !== 'GET') return false;
  if (pathname === '/') {
    serveHtml(res, 'index.html');
    return true;
  }
  if (pathname === '/agent' || pathname === '/agent/' || pathname === '/agent-interface.html') {
    serveHtml(res, 'agent-interface.html');
    return true;
  }

  const asset = STATIC_ASSETS.get(pathname);
  if (asset) {
    const [filename, contentType, headers = {}] = asset;
    await sendFile({ res, publicDir, filename, contentType, headers, securityHeaders });
    return true;
  }

  if (PNG_ASSET.test(pathname)) {
    await sendFile({ res, publicDir, filename: pathname.slice(1), contentType: 'image/png', headers: {}, securityHeaders });
    return true;
  }

  return false;
}
