const CACHE = "hexigrid-shell-v38";
const SHELL = ["/", "/agent-interface.html", "/brand.js", "/styles.css", "/identity.css", "/brand-motion.css", "/interactions.css", "/boot-layer.css", "/boot-loader.css", "/boot-particles.js", "/boot-veil.js", "/boot-environment.js", "/boot-loader.js", "/interactions.js", "/browser-crypto.js", "/browser-vault.js", "/browser-providers.js", "/standalone-runtime.js", "/agent-interface.css", "/agent-interface.js", "/on-device-inference.js", "/on-device-chat.js", "/icons.js", "/guide-content.js", "/agent-ui.js", "/chat-ui.js", "/communication-ui.js", "/workspace-ui.js", "/guide-ui.js", "/hexigrid-mark.svg", "/app.js", "/providers.js", "/harnesses.js", "/control-shell.js", "/task-ui.js", "/plugin-ui.js", "/backup-ui.js", "/google-backup.js", "/integrations.js", "/auth-ui.js", "/live-voice.js", "/live-recording.js", "/live-call.js", "/live-communication.css", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-maskable-192.png", "/icon-maskable-512.png", "/apple-touch-icon-180.png", "/splash-1170x2532.png", "/splash-2048x2732.png"];
SHELL.push("/live-generated-voice.js");
const RUNTIME_ASSETS = new Set(["/on-device-worker.js", "/vendor/web-llm.js", "/vendor/firebase-google.js"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.search || (!SHELL.includes(url.pathname) && !RUNTIME_ASSETS.has(url.pathname))) return;
  event.respondWith(fetch(request).then((response) => {
    const copy = response.clone();
    if(response.ok && !response.redirected) event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || (request.mode === "navigate" ? caches.match("/") : Response.error()))));
});
