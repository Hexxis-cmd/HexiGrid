# Platform verification matrix

HexiGrid uses one human setup flow with two runtime backends: an optional local Node control plane and a standalone encrypted browser runtime. A cloud model never needs Node.js on the phone; only host capabilities such as desktop files, CLI processes, iLands Runner supervision, containerized MCP/plugins, and reliable background scheduling need the local service.

| Platform | Browser UI | Local service | Local models/files/plugins | Device notes |
|---|---|---|---|---|
| Windows 10/11 x64 | Chrome, Edge, Firefox | Supported | OpenCode, workspace, plugins, DPAPI vault, LAN pairing; local MCP requires rootless Podman; browser models work when WebGPU is available | Official iLands Windows handoff remains an ordinary PowerShell action |
| macOS 11+ | Safari, Chrome, Firefox | Supported by Node | Workspace/plugins; Keychain adapter when security is available; local MCP requires rootless Podman; browser models depend on WebGPU/browser support | iLands Runner follows the official darwin branch |
| Linux glibc 2.28+ | Chrome, Firefox | Supported by Node | Workspace/plugins; Secret Service when secret-tool is available; local MCP requires rootless Podman; browser models depend on WebGPU/browser support | iLands Runner follows the official Linux branch |
| Android/iOS | Mobile browser/PWA | Optional; not required for direct-capable cloud APIs | Standalone encrypted profiles, rooms, direct cloud chat, local backup, and browser models where WebGPU is available; paired host adds Runner, CLIs, files, isolated tools, and reliable schedules | Direct HTTPS is tried first. A provider-supported browser flow, user-owned relay, or paired host is offered only after the selected provider request is blocked or unreachable |

The service listens on loopback by default. LAN mode requires an explicit `--network` start, owner-provided HTTPS credentials, and a one-time pairing code. Plain HTTP LAN mode fails closed. Host OS-vault secret creation and executable connector installation remain host-only. A standalone browser can instead create its own passcode-derived encrypted vault and connect a CORS-capable cloud provider directly.

Automated and source-level verification completed in the local control-room preview:

- desktop authenticated navigation;
- mobile-sized stacked task, plugin, provider, and settings layouts;
- empty roster with no seeded agents;
- local passcode setup and locked bootstrap;
- encrypted backup controls and Google Drive configuration surface;
- plugin manager empty-state and task manager empty-state;
- static scripts pass `node --check`; server-system tests cover the authenticated API paths. Manual browser/device acceptance remains an owner/community test because this repository cannot represent every physical phone, browser extension, OS policy, or local model installation.

Automated checks run with npm test and npm run check.
