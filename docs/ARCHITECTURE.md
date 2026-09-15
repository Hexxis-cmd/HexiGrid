# Architecture

## Shape

HexiGrid has one interface with two local-first runtimes: an optional Node control plane for operating-system capabilities and a standalone encrypted browser runtime for direct-capable cloud APIs and browser-native models.

```text
Responsive human UI + predictable agent UI + versioned machine manifest
                 |                                  |
       standalone browser runtime          optional Node control plane
       Web Crypto + IndexedDB               local authenticated API
       direct HTTPS / WebGPU                         |
                 +---------------+------------------+
                                 |
                Policy engine ---- Approval inbox ---- Audit ledger
                                 |
              Orchestrator ---- Rooms / goals / subagents / schedules
                 |       |       |        |        |
              Models  Accounts  Plugins   Devices  Media
                 |       |       |        |        |
          Cloud APIs    iLands   MCP/A2A  Browser  ComfyUI/etc.
          Ollama/LM Studio       Apps      Robots
          CLI harnesses (host-only, explicit opt-in after detection)
                                 |
        encrypted browser vault or encrypted local database + OS vault
                                 |
                   optional client-encrypted backup envelope
```

## Trust boundaries

- Hosted local-service UI: never receives raw long-lived provider secrets; the local API exchanges secret values directly with the operating-system vault.
- Standalone browser UI: accepts provider keys only in its credential form, encrypts them into IndexedDB with a passcode-derived non-exportable Web Crypto key, and keeps the decrypted state in memory only while unlocked. Keys are never inserted into chats, receipts, exports, or the machine-facing manifest.
- Local API: authenticated with a local passcode/session and bound to loopback by default; explicit LAN mode adds pairing plus browser anti-forgery checks. Optional app-managed Cloudflare Quick Tunnel requests are accepted only while that process is active and its exact generated hostname matches; they remain remote for pairing, authentication, CSRF, rate limiting, and all host-only route restrictions.
- Vault: stores credentials through Windows DPAPI/Credential Manager, macOS Keychain, or Linux Secret Service when available.
- State database: an authenticated encrypted local JSON envelope; workspace, plugin, media, and Runner data remain private local folders and are included in encrypted backups.
- Model adapter: receives only the minimum context selected by the context builder.
- Harness detector: probes OpenCode, Claude Code, and Codex without exposing command paths or account output. Detection never creates a connection; the user must explicitly connect a signed-in harness before it contributes models or executes work.
- Tool executor: dispatches only after the policy engine evaluates the declared capability and risk.
- Plugin host: versioned, content-addressed packages with SHA-256 file inventories, optional Ed25519 publisher signatures pinned in the OS vault, input/output schemas, exact file and network grants, broker-only I/O, action receipts, and quarantine on any integrity change. Execution uses a clean, resource-bounded Node permission process with direct filesystem, network, process, worker, native-addon, environment, and external-package access denied.
- Agent-account connector: isolated; one iLands Runner home/session per linked identity.
- Sync: optional, owner-controlled, encrypted on-device. The cloud cannot decrypt private payloads.

## Provider contracts

- `ModelProvider`: text completion, native request formats, usage, health, and cancellation.
- `MediaProvider`: image/audio/video generation with local and cloud implementations.
- `AgentConnector`: identity import, memory exchange, presence, messages, capabilities, health.
- `ToolProvider`: typed tools from plugins, MCP, apps, local executables, and browser/device adapters.
- `CredentialProvider`: secret create/read/revoke without exposing values to models.
- `SyncProvider`: encrypted envelopes, device membership, conflict metadata, recovery.

## Connection lifecycle

Fresh state has no providers, harness connections, model routes, or agents. The universal AI Connections screen offers remote API keys, local model servers, and signed-in computer tools as equal choices. Provider model IDs are fetched from the selected endpoint. CLI detection is read-only; a separate user action creates the connection record. Disconnecting a harness immediately removes its models from routing.

## Execution record

Every attempted connector, tool, task, or media action records its actor when known, capability, risk, status, safe detail, source, and timestamp. Secrets and raw credentials are excluded; chat content remains in encrypted local state rather than the receipt index.

## Cross-device design

Google sign-in authorizes HexiGrid to use its own hidden app-data folder in that user's Google Drive. It does not unlock local data. Drive stores client-side encrypted backup envelopes and bounded version history; OS-vault credentials are excluded and must be re-entered on a new device. Restored provider sessions are best-effort because providers can expire or revoke tokens independently.

`public/agent-mail.js` is the optional external-identity bridge for agents with working email accounts. It uses the separately scoped Google Mail adapter in `client/firebase-google.js`; Drive and Mail tokens are isolated in memory. The module sends plain-text messages or temporary call invitations, polls only while the page is open, imports replies into the existing live transcript, and posts metadata-only receipts through the local authenticated API. It never accepts an agent mailbox password or iLands session.

The default scope is `drive.appdata`, not broad access to a user's visible Drive files. Backup files are owned by the user and count against that user's Drive storage. Large media libraries remain local unless the owner explicitly selects another storage connector.

## Browser and desktop parity

The responsive human interface is the same on every platform, but the available capabilities follow the active runtime. A standalone phone or browser first attempts cloud-provider HTTPS requests directly and never requires Node.js for model inference. Pairing is optional and is offered only after the chosen provider blocks direct browser requests or when the user selects a host-only feature such as CLI harnesses, iLands Runner, desktop files, container-isolated plugins/MCP, or reliable background scheduling. A browser on the same computer can use every local capability through the loopback service; the desktop launcher starts and supervises that service rather than defining a separate product.
## Browser feature modules

The browser shell loads independent modules in dependency order. `browser-crypto.js`, `browser-vault.js`, `browser-providers.js`, and `standalone-runtime.js` own the no-host runtime. `agent-interface.html`, `agent-interface.js`, and `lib/agent-interface.mjs` define the predictable agent-facing surface and authenticated machine manifest. `icons.js` owns the reusable HexiGrid icon language; `guide-content.js` owns help content and the setup prompt; `guide-ui.js` renders it; `agent-ui.js`, `chat-ui.js`, `communication-ui.js`, and `workspace-ui.js` own those user experiences; `providers.js` owns model-provider setup; `harnesses.js` owns detected CLI tools; and `integrations.js` owns iLands/MCP/media connections. `control-shell.js` creates shared control surfaces, while `task-ui.js`, `plugin-ui.js`, `backup-ui.js`, `auth-ui.js`, and `google-backup.js` each own one control domain. Shared state, API helpers, view routing, model selection, onboarding, and initialization remain in `app.js`. New feature behavior must live in its matching module rather than growing the core file.

Visual behavior is split the same way: `brand-motion.css` owns the animated wordmark and `interactions.css` owns tactile controls. The boot experience is deliberately modular: `boot-loader.css` and `boot-loader.js` own the central holographic icosahedron, its roughly 2.25-second top-to-bottom spiral of individually dismantling outer facets, the inner structure's immediate progressive heat/instability response, its final controlled-radiance phase, and the compositor-safe core reveal; `interactions.js` synthesizes one short release tick per facet through the shared optional UI-audio context, so the same user sound preference controls both buttons and boot audio; `boot-particles.js` owns the offscreen field of true wireframe icosahedrons and its inertial pointer response; `boot-veil.js` owns the translucent holographic veil, variable-width rounded tear, glow seams, dirty-region compositing, and final full-surface cleanup that prevents stale reveal artifacts; and `boot-environment.js` schedules pointer input, tail-first healing, resizing, and cleanup. The environment stops rendering while idle, pauses in hidden tabs, caps active animation at 30 frames per second on desktop and 24 on coarse-pointer devices, and disables the interactive tear when reduced motion is requested. `boot-layer.css` owns only the safe transition between boot and application layers. Live behavior is separate too: `live-call.js` owns user-triggered camera, microphone, screen-share, speech-recognition, one-agent routing, and ephemeral transcript state; `live-voice.js` owns browser voice discovery, three real previews, bounded per-agent voice preferences, and stop behavior; `live-communication.css` owns the responsive live layout; and `lib/live-communication.mjs` owns server-side bounds and transcript/voice normalization. The environment remains local by default and exposes capability fallbacks instead of pretending an iLands Runner is a remote WebRTC peer. `lib/static-assets.mjs` is the single allowlist for browser-delivered files; the server entry point delegates shell delivery to it instead of duplicating one route per asset.

The Live surface remains split into focused modules. `live-call.js` coordinates the one-responder session, browser permission requests, wake-phrase loop, and deliberate still-frame attachment; `live-voice.js` handles free device speech; `live-generated-voice.js` handles bounded OpenAI-compatible speech, consented custom-voice creation, and provider-issued voice IDs; `live-realtime.js` owns opt-in provider WebRTC audio; `avatar-viewer.js` lazy-loads the locally bundled 3D renderer only for GLB avatars; and `live-recording.js` handles explicit device-only recording and download. Server boundaries remain separate in `speech-provider.mjs`, `custom-voice-provider.mjs`, `realtime-provider.mjs`, and `avatar-model.mjs`. Stopping speech never cancels the written model turn. Continuous camera/screen pixels are not sent to a model, and no iLands Runner is represented as a WebRTC peer without a real signaling contract.

## Release privacy gate

The tracked `.githooks/pre-push` hook runs syntax checks, the complete automated test suite, the dependency audit, and `scripts/release-preflight.mjs`. The scanner checks the exact outgoing commit range as well as every candidate tracked file for credential files, private runtime folders, common secret formats, private keys, and machine-specific user paths. Install the repository hook once with `npm run hooks:install`. A failed check blocks the push.
