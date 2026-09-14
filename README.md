# HexiGrid

HexiGrid is a local-first, privacy-focused AI agent dashboard and multi-agent control room for Windows, macOS, Linux, and modern mobile browsers. Connect cloud APIs, browser-native on-device models, free model gateways, Ollama, LM Studio, OpenCode, Claude Code, Codex, iLands BYOA, plugins, and MCP tools in one place—with live model discovery, per-agent personalities, chat rooms, permissions, automation, usage tracking, and encrypted backups.

It is a bridge between people and the AI tools they already use. You can run it locally without a paid HexiGrid account, keep private data on your own device, and add cloud backup only when you choose it.

## What it includes

- A single setup flow for direct cloud API keys, browser-native models, local model servers, and detected signed-in CLI tools.
- A standalone-browser runtime: a phone can use direct-capable cloud APIs with no desktop or Node.js process, protected by a passcode-derived encrypted browser vault.
- Separate human and AI-readable control surfaces backed by the same authentication and permission rules.
- A no-key browser path for supported devices to run small WebGPU models locally.
- Any number of agents, accounts, model providers, chat rooms, tasks, plugins, and workspaces.
- Live model discovery instead of an outdated built-in model list.
- Agent profiles with names, pictures, personalities, instructions, rules, memories, and model routing.
- One-to-one and group chat with local activity receipts and token usage tracking.
- Planning, conversation, research, build, goal, and watch modes with approval controls.
- Bounded autonomous tasks with pause, cancellation, retries, limits, and emergency stop.
- Reviewed plugins and MCP tools with capability permissions, digest checks, isolation, and revocation.
- Local image generation support when a connected provider exposes image models.
- Encrypted local state, encrypted backup and restore, Google Drive backup as an optional separate connection, and OS-protected API keys.
- Installable PWA behavior, mobile layouts, offline shell support, and secure LAN pairing.

## Run it with the local service

The local service enables desktop files, CLI harnesses, isolated plugins/MCP, reliable scheduled work, iLands Runner supervision, OS-vault secrets, and Google Drive backup. You do not need a HexiGrid cloud account.

1. Install [Node.js 22 or newer](https://nodejs.org/en/download).
2. Open PowerShell, Terminal, or another command window.
3. Download this repository:

   ```text
   git clone https://github.com/Hexxis-cmd/HexiGrid.git
   cd HexiGrid
   ```

4. Install the app files:

   ```text
   npm install
   ```

5. Start HexiGrid:

   ```text
   npm start
   ```

6. Open [http://127.0.0.1:4318](http://127.0.0.1:4318) in your browser.
7. Create a local passphrase. It protects this device's HexiGrid workspace and is never sent to an AI provider.

The first launch is intentionally empty. Nothing connects automatically, even if OpenCode, Claude Code, or Codex happens to be installed.

## Use it on a phone without a desktop

When the PWA files are served over HTTPS, HexiGrid detects that no local service exists and opens its standalone-browser runtime. Create a browser passcode, open **AI connections**, and paste a key for a cloud provider. HexiGrid attempts the provider's HTTPS API directly; Node.js is not installed or run on the phone. Providers that reject direct browser requests through CORS need that provider's supported browser login, a relay the user controls, or optional pairing to a trusted host.

The standalone vault uses PBKDF2-SHA-256 with 600,000 rounds and a unique random salt to derive a non-exportable AES-256-GCM key from the passcode. Only the encrypted envelope, salt, and non-secret algorithm settings are stored in IndexedDB. This protects copied browser storage at rest; it does not protect an unlocked page, a compromised device/browser, or a forgotten passcode.

## Use it for the first time

1. Open **AI connections**.
2. If you are unsure, choose **API key → OpenCode Zen** first and check its current pricing. Otherwise choose **API key**, **This device**, **Local model app**, or **Signed-in computer tool**.
3. Follow the simple guide beside the connection choice.
4. Choose **Connect and find models**. HexiGrid asks the selected service for the models your account can actually use.
5. Open **Agents**, choose **Add agent**, and select one of the discovered models.
6. Give the agent a name and optional personality, instructions, rules, and picture.
7. Open **Chat rooms**, create a room, select the agent, and send a short test message.
8. Use **Activity** to see what happened and **AI usage** to see token totals.

For an easy walkthrough, open **How-to guide** inside the app or read the [plain-language guide](docs/HOW-TO-GUIDE.md). It explains every supported connection, including current official sources and the exact HexiGrid fields to use.

## iLands and other AI tools

iLands is the first account connector. HexiGrid uses the official BYOA Runner boundary and never asks for an iLands password or browser cookie. An app-created iLander may not be eligible for BYOA binding; check the live iLands instructions shown in the app.

OpenCode, Claude Code, and Codex are optional computer tools. HexiGrid offers them only after it detects that they are installed and already signed in. You must still click **Connect**.

HexiGrid also accepts compatible cloud endpoints and compatible local servers, so the app is not tied to one AI company. Model names, prices, and free-tier availability change; the app discovers models live and the guide links to the provider's current documentation.

## Privacy and security

HexiGrid stores chats, memories, profiles, tasks, receipts, and settings locally by default. API keys and connector secrets are stored in the operating system's credential vault, not in source files, prompts, ordinary JSON state, exports, or logs. Optional Google Drive backup uploads encrypted ciphertext only after you enable it and complete Google's consent flow.

Never paste a password, API key, browser cookie, recovery phrase, or session token into a chat, issue, screenshot, terminal command, or Git commit. Read [Data and privacy](docs/DATA-PRIVACY.md) and [Trust modes](docs/TRUST-MODES.md) before enabling tools or autonomous work.

## Phone and LAN use

Direct-capable cloud APIs and supported browser-native models work in the standalone PWA with no desktop. To use desktop files, CLI harnesses, isolated plugins/MCP, iLands Runner, or reliable background tasks from a phone, run HexiGrid in network mode with a trusted certificate and pair the device through the in-app link. Network mode requires HTTPS; see [Secure network setup](docs/SECURE-NETWORK.md).

AI agents can use the predictable [agent interface](public/agent-interface.html) and its authenticated `/api/agent-interface` manifest. The complete system-style integration prompt is in [Agent integration instructions](docs/AGENT-INTEGRATION-PROMPT.md).

## Help and bug reports

Read the [How-to guide](docs/HOW-TO-GUIDE.md) first. If something still behaves incorrectly, [report an issue on GitHub](https://github.com/Hexxis-cmd/HexiGrid/issues) and include your operating system, browser, HexiGrid version, the steps that caused the problem, and the safe error message shown by the app. Never include credentials or private agent data. For commercial licensing, email [contact.hexigrid@proton.me](mailto:contact.hexigrid@proton.me); GitHub Issues remain available for general questions.

## License

HexiGrid is available for noncommercial use under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). Commercial use requires a separate license. See [the commercial licensing template](COMMERCIAL-LICENSE-TEMPLATE.md) for the current offer and contact [contact.hexigrid@proton.me](mailto:contact.hexigrid@proton.me) for a signed agreement.

## Status

HexiGrid `0.0.1` is an early alpha intended for careful community testing. Please read the documentation and review the permissions before connecting real accounts or allowing an agent to take outside actions.
