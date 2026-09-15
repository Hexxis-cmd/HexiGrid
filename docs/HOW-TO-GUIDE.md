# HexiGrid how-to guide

The complete, current guide is built into HexiGrid. Open **How-to guide** from the left menu on a computer or **More → How-to guide** on a phone. The in-app guide is the canonical copy because it can point at the controls that are actually installed.

Every outside connection shows two kinds of help together:

1. **Simple steps** opens HexiGrid's short guide in plain language.
2. **Official guide** opens the service owner's current documentation.

The paired links are shown on AI connections, iLands Runner, Google Drive backup, and MCP setup. The official source is the authority when an outside service changes.

## The shortest safe setup

1. Start HexiGrid and create a local passphrase.
2. Open **AI connections**.
3. Pick exactly one connection type:
   - **OpenCode cloud/Zen** is the recommended first cloud option when you do not know where to start. OpenCode is free/open source; Zen's current account requirements and model prices can be free, promotional, or metered.
   - **API key** for OpenAI, Anthropic, Google Gemini, Hugging Face, or another compatible cloud API.
   - **This device** for a supported model that runs inside this browser with WebGPU.
   - **Local model app** for Ollama, LM Studio, or another OpenAI-compatible local server.
   - **Signed-in computer tool** for OpenCode, Claude Code, or Codex, but only when HexiGrid detects it as installed and signed in.
4. Choose **Connect and find models**. Do not continue until HexiGrid shows at least one model from that connection.
5. Open **Agents**, add one agent, and select one discovered model.
6. Open **Chat rooms**, select the agent, and send a harmless test message.
7. Open **Activity** and confirm the message completed.

Nothing is connected automatically. A fresh clone starts with no providers, no agent accounts, and no personal machine configuration.

## First: what HexiGrid actually does

HexiGrid is the bridge, not the AI. You connect one source of AI, and that gives your local agents something to think with. From there, those agents can join rooms and—only when you approve the access—work with iLands, plugins, MCP tools, files, or other compatible frameworks. You do **not** need iLands. You do **not** need a terminal. One working API key is enough to begin.

Every path below uses the same screen: open **AI connections**, choose one of the four big connection types, and follow that path. HexiGrid asks the provider for its current model list. It does not trap you in an old hardcoded list.

On a standalone phone or browser, a cloud model does **not** need Node.js or a desktop. HexiGrid creates an encrypted browser workspace, attempts the selected provider's HTTPS API directly, and stores the key only inside that encrypted browser vault. Pairing is an optional fallback for desktop files, CLIs, long-running background work, isolated plugins/MCP, or a provider that rejects direct browser requests through CORS.

If you open the separate **Agent interface** in another browser tab, enter your local passcode there too. The usable encryption key is intentionally kept only in each unlocked tab's memory; your passcode is processed locally and is never sent to an AI provider.

## Start here: OpenCode cloud/Zen

1. **What it is:** OpenCode is a free, open-source AI tool, and OpenCode Zen is its hosted model gateway. You can use a Zen API key directly in HexiGrid without installing the OpenCode CLI or Node.js on your phone.
2. **What you need:** An OpenCode account, internet access, and whatever account verification or billing details the current Zen signup requires. The official guide currently describes usage-based charges; individual free or promotional models can change.
3. **Where to get it:** Open the [official OpenCode Zen page](https://opencode.ai/docs/zen), choose **Sign in**, complete the current account steps, create an API key, and copy it while visible. Keep the [provider guide](https://opencode.ai/docs/providers) nearby if the labels change.
4. **Plug it in:** Open **AI connections → API key → OpenCode Zen**. Paste the key only in the protected field and choose **Connect and find models**. HexiGrid fetches the current catalog instead of shipping a frozen list.
5. **Cost and limits:** OpenCode itself is free/open source. Zen's provider page is the authority for current prices, limits, billing requirements, and temporary free models. A free key does not mean every request is free.
6. **Send the first test:** Open **Agents → Connect or create → Local agent**. Name it `Test Agent`, assign one returned OpenCode model, then open **Chat rooms**, create `First test`, select that agent, and send `Reply with exactly: HexiGrid connected.`
7. **Verify it:** Confirm the reply appears, then open **Activity** and confirm the model action says **completed**. If either is missing, setup is not done.
8. **Use it with another framework:** For iLands, open **Connections & tools** and follow the BYOA Runner guide. For CrewAI, LangGraph, Microsoft Agent Framework, AutoGen, or another system, use its current official model/MCP/A2A connector; do not paste a key into an agent prompt.

## OpenAI API key

1. **What it is:** OpenAI runs AI models online. An API key is a private password made for apps; it is not your ChatGPT password.
2. **What you need:** An [OpenAI API account](https://platform.openai.com/), internet access, and API billing or credit. A ChatGPT subscription does not automatically include API credit.
3. **Where to get it:** Open [API keys](https://platform.openai.com/api-keys), choose **Create new secret key**, and copy the key while it is visible. The [official quickstart](https://developers.openai.com/api/docs/quickstart) has the longer version.
4. **Plug it in:** In HexiGrid choose **API key → OpenAI**. Paste the key only into **Paste your OpenAI API key**, then choose **Connect and find models**.
5. **Cost and limits:** It is pay-as-you-go. Prices and request limits depend on the model and account tier; check the [current model page](https://developers.openai.com/api/docs/models) before long jobs.

## Anthropic API key

1. **What it is:** Anthropic runs Claude models online. Its Console makes the private key HexiGrid uses.
2. **What you need:** An Anthropic Console account, internet access, and API credit. A Claude chat plan and Console API billing are separate things.
3. **Where to get it:** Open [Anthropic Console keys](https://console.anthropic.com/settings/keys), choose **Create Key**, and copy it. Here is the [official API overview](https://platform.claude.com/docs/en/api/overview).
4. **Plug it in:** Choose **API key → Anthropic**, paste the key in the protected box, then choose **Connect and find models**.
5. **Cost and limits:** API calls are billed by model and token. Anthropic also uses spend and request tiers; see the [current limits](https://platform.claude.com/docs/en/api/rate-limits).

## Google Gemini API key

1. **What it is:** Gemini is Google's cloud AI service. Its AI Studio key is unrelated to the separate Google Drive backup connection.
2. **What you need:** A Google account, Gemini API access in your region, an auth/API key, and internet access.
3. **Where to get it:** Follow Google's [Get a Gemini API key](https://ai.google.dev/gemini-api/docs/api-key) page and use the button it shows for Google AI Studio.
4. **Plug it in:** Choose **API key → Google Gemini**, paste the key, then choose **Connect and find models**.
5. **Cost and limits:** Some models have a free tier with per-project limits. Paid use varies by model; read [billing](https://ai.google.dev/gemini-api/docs/billing) and [current pricing](https://ai.google.dev/gemini-api/docs/pricing) before enabling it.

## Hugging Face hosted inference

1. **What it is:** Hugging Face is a huge model library. Its inference providers can run some of those models online for you.
2. **What you need:** A Hugging Face account, a token with inference permission, internet access, and a model actually offered for hosted inference.
3. **Where to get it:** Open [Access Tokens](https://huggingface.co/settings/tokens), create a narrowly scoped token, then read the [official inference guide](https://huggingface.co/docs/hub/models-inference).
4. **Plug it in:** Choose **API key → Hugging Face**, paste the token, then choose **Connect and find models**.
5. **Cost and limits:** Free accounts currently receive a very small monthly inference credit. Extra hosted use needs credit; see [current pricing](https://huggingface.co/docs/inference-providers/pricing). A model existing on the website does not guarantee hosted chat support.

## Another compatible cloud API

1. **What it is:** This is another cloud provider that accepts the common OpenAI-style chat format.
2. **What you need:** The provider's exact base API address, an API key if it requires one, internet access, and that provider's documentation.
3. **Where to get it:** Use the provider's own setup page. Look specifically for **OpenAI-compatible endpoint**, **Base URL**, **API key**, and **Models**. Do not guess the address.
4. **Plug it in:** Choose **API key → Another compatible API**. Open **Connection details**, paste the address, keep **OpenAI-compatible chat** unless the provider says otherwise, paste the key, and choose **Connect and find models**. Use **Manual model IDs** only when its docs say model listing is unavailable.
5. **Cost and limits:** The provider decides all prices, privacy terms, regions, and rate limits. HexiGrid cannot safely infer those from a URL.

## Run a model in this browser

1. **What it is:** A browser-native model runs inside the browser on your own computer or phone. WebLLM uses WebGPU and a worker so the text stays local to that browser.
2. **What you need:** A current browser with a usable WebGPU adapter, enough graphics memory and storage, and time for the first download. No account or API key is required.
3. **Where to get it:** You do not need to install anything. Open **AI connections → This device**. HexiGrid checks the browser and shows the models it can use. Read the [WebLLM source and model support](https://github.com/mlc-ai/web-llm) and the [private browser chat example](https://github.com/mlc-ai/web-llm-chat) if you want the technical background.
4. **Plug it in:** Choose an available model, choose **Use this model**, then assign it to an agent or select it for the control assistant. The first message downloads the model and shows progress.
5. **Cost and limits:** There is no per-message API bill. The model uses your device battery/electricity, storage, and graphics memory. Support varies by browser, phone, and hardware. If WebGPU is unavailable, use an API key, local model app, or signed-in computer tool instead.

The model download is kept in the browser's private cache. Choosing **Remove download** or clearing site data removes it. HexiGrid never silently switches this local model to a paid cloud model.

## Ollama local models

1. **What it is:** Ollama is a free app that downloads and runs models on your computer. Your prompts stay with that local server unless the chosen model or tool itself calls something online.
2. **What you need:** A supported computer, enough memory and storage, Ollama, and one downloaded model.
3. **Where to get it:** Use the [official Ollama quickstart](https://docs.ollama.com/quickstart). Windows users can use the [Windows instructions](https://docs.ollama.com/windows). Pick a model from the [official library](https://ollama.com/library).
4. **Plug it in:** Start Ollama. In HexiGrid choose **Local model app → Ollama**. Keep `http://127.0.0.1:11434/v1` unless you deliberately changed it, leave the key blank, and choose **Connect and find models**.
5. **Cost and limits:** No per-message cloud bill for normal local use. Models can use many gigabytes of disk and memory; speed depends on your computer and electricity is still real, sadly.

## LM Studio local models

1. **What it is:** LM Studio is a visual desktop app for finding, downloading, and running models locally.
2. **What you need:** A supported computer, enough memory and storage, LM Studio, and one downloaded model.
3. **Where to get it:** Start with [LM Studio basics](https://lmstudio.ai/docs/app/basics), then [download a model](https://lmstudio.ai/docs/bionic/models/download-local-models).
4. **Plug it in:** Load the model, open LM Studio's **Developer** area, and start the [local server](https://lmstudio.ai/docs/developer/core/server). In HexiGrid choose **Local model app → LM Studio**, keep `http://127.0.0.1:1234/v1` unless LM Studio shows another address, and choose **Connect and find models**.
5. **Cost and limits:** Local downloaded models have no per-message cloud fee. Hardware, storage, electricity, and any optional remote provider are separate.

## Another local model server

1. **What it is:** This catches any local AI app that exposes an OpenAI-compatible server.
2. **What you need:** The model app, one loaded model, its server switched on, and the exact address it displays.
3. **Where to get it:** Use that app's official **OpenAI-compatible API** or **Local server** page. Copy its local address exactly.
4. **Plug it in:** Choose **Local model app → Another local model server**. Open **Connection details**, paste the address, add a key only if you configured one, then choose **Connect and find models**.
5. **Cost and limits:** Usually there is no per-message cloud fee. The selected app or remote model may have its own terms. Keep it on `127.0.0.1` unless you understand and secure network access.

## OpenCode CLI

1. **What it is:** OpenCode is an open-source AI tool used from a terminal. This is optional and different from an OpenCode Zen API key.
2. **What you need:** OpenCode installed and at least one provider connected inside it. If you do not enjoy terminals, use an API key above instead.
3. **Where to get it:** Follow [Install OpenCode](https://opencode.ai/en/docs), run `opencode`, and use `/connect` as explained in [provider setup](https://opencode.ai/docs/providers). Make sure a normal OpenCode chat works.
4. **Plug it in:** In HexiGrid choose **Signed-in computer tool → Scan again**. If OpenCode says **Detected and signed in**, choose **Connect** beside it. Nothing is connected automatically.
5. **Cost and limits:** OpenCode itself is open source. Its connected model may be free, local, subscription-backed, or paid by usage.

## Claude Code

1. **What it is:** Claude Code is Anthropic's terminal AI tool. It can use an eligible Claude account, Console billing, or supported enterprise provider.
2. **What you need:** Claude Code installed, a supported account, and a completed sign-in. Windows users need one of the supported shells listed by Anthropic.
3. **Where to get it:** Follow the [official Claude Code setup](https://docs.anthropic.com/en/docs/claude-code/getting-started), run `claude`, sign in, and make sure one harmless prompt works.
4. **Plug it in:** Choose **Signed-in computer tool → Scan again**, then choose **Connect** beside Claude Code only when it says **Detected and signed in**.
5. **Cost and limits:** Your Claude subscription, Console API, or enterprise provider determines cost and limits. They are not interchangeable.

## Codex CLI

1. **What it is:** Codex CLI is OpenAI's terminal coding agent. You can skip it completely when an API-key or local-server path is easier.
2. **What you need:** Codex installed, a currently accepted ChatGPT or API sign-in, and one successful test run.
3. **Where to get it:** Follow the [official Codex CLI quickstart](https://learn.chatgpt.com/docs/codex/cli), run `codex`, and choose the sign-in method it currently offers.
4. **Plug it in:** Choose **Signed-in computer tool → Scan again**. When Codex says **Detected and signed in**, choose **Connect** beside it.
5. **Cost and limits:** The current ChatGPT or API plan used by Codex decides access and limits. Check the official page and your account before long or autonomous tasks.

All provider details above were checked against the linked official pages in September 2026. Outside services change. That is why the app pairs our short instructions with the official source and discovers models live.

## Secrets

Enter a key only in a password field inside **AI connections**, **Plugin credentials**, or the relevant protected setup dialog. A desktop host stores it in the operating-system credential vault. A standalone browser encrypts it with AES-256-GCM using a key derived from the browser passcode with PBKDF2-SHA-256 (600,000 rounds); the passcode and usable key are not saved. Never put a key, password, token, recovery phrase, cookie, or session identifier in:

- a chat or agent prompt;
- a source or configuration file;
- a screenshot;
- a terminal command that will be saved in history;
- a Git commit;
- an issue or support message.

If the operating-system vault is unavailable, a desktop-host workspace remains usable but refuses host secret setup and explains how to enable the vault. In standalone-browser mode, forgetting the passcode means the encrypted workspace cannot be recovered unless you exported a separate encrypted backup.

## Common setup problems

### No models appear

Open **AI connections**, find the connection, and choose **Refresh models**. For a cloud API, check the key, API account, internet access, and service limits. For Ollama or LM Studio, start the local server and load or download at least one model first.

### A command-line tool is not listed

Sign in to that tool outside HexiGrid, restart HexiGrid if it was just installed, then use **Signed-in computer tool → Scan again**. HexiGrid will not offer an undetected or signed-out tool and will never connect one silently.

### An iLands agent does not appear

Open **Connections & tools**, read the exact Runner status, complete the iLands browser approval, and restart only that Runner. Each iLands account must have its own Runner connection and isolated home folder. Never paste an iLands password or browser session into HexiGrid.

### A cloud provider does not connect directly on a phone

First check the internet connection, exact API address, account status, and key. If those are correct, the provider may block direct browser calls with CORS. Only then use a provider-supported browser login, a relay you control, or optional pairing to a trusted HexiGrid host. A CORS/network failure is not proof that the key is wrong.

### A phone cannot pair with an optional host

Pairing is not required for direct-capable cloud APIs or browser-native models. For host-only files, CLIs, isolated plugins/MCP, or background work, put the computer and phone on the same trusted private network, start secure network mode, use the current pairing link, and allow HexiGrid through the host firewall. Turn network mode off on public Wi-Fi.

### A task or tool is blocked

Read the nearby explanation and the newest Activity receipt. Planning and Converse modes cannot perform changes. Full access removes prompts only inside permissions already granted; it never creates new file, network, account, spending, or device access.

### A restore was wrong

Use **Roll back last restore**. HexiGrid keeps an encrypted pre-restore snapshot. Backup passphrases cannot be reset, so store yours somewhere you control.

## Let an AI guide the setup

Open **How-to guide → Let an AI guide setup** and choose **Copy setup prompt**. The prompt teaches an assistant to identify the right connection type, use the visible HexiGrid flow, stop for account consent, and keep secrets out of chat, logs, files, and Git. It does not give the assistant new permissions. The complete LLM-oriented version is in [Agent integration instructions](AGENT-INTEGRATION-PROMPT.md), and the predictable control surface is available at `/agent-interface.html` with its machine-readable manifest at `/api/agent-interface`.

## Talk with one agent live

The **Live** screen gives one agent the floor at a time. It is not a hidden call to iLands and it never starts your camera, microphone, screen, or recorder by itself.

1. Open **Live** and choose the agent that should answer.
2. Type a message, or choose **Start listening** and answer the browser's microphone question. A wake phrase is optional and only listens while this page is open.
3. Choose **Start camera + mic** only if you want a private preview. Choose **Preview screen** to switch to a tab, window, or screen selected in the browser picker.
4. To let a compatible vision model see one moment, choose **Attach current frame**, then send the message. The live video stays local; HexiGrid sends only that resized still image. Turn on **Include one fresh frame with every message** only when you want that behavior.
5. For free spoken replies, preview the voices already on the device and save one to the agent. For a connected OpenAI-compatible speech service, mark that provider as supporting speech, enter its speech model and permitted voice IDs, make three real previews, and save the one you choose. Provider speech may cost money.
6. For a real low-latency provider call, mark the connection as **Realtime voice**, choose its realtime model in Live, and press **Start realtime call**. HexiGrid asks for microphone permission and any required policy approval. The browser uses WebRTC while the saved API key stays in the host credential vault. If a camera or screen preview is already open, you may separately turn on **Share live visual context**; it sends small snapshots at the rate you choose, never raw continuous video. This works only with providers exposing the compatible endpoint and may cost money.
7. To create a custom voice, open **Create a custom voice from consented recordings**. Add the exact spoken-consent file required by the provider and one clean sample, confirm the speaker agreed, then create and preview the returned voice. Each file must be supported audio under 10 MB. OpenAI currently limits this feature to eligible customers; see the [official Audio API](https://platform.openai.com/docs/api-reference/audio/createVoice).
8. To use a 3D avatar, edit the agent and choose one self-contained `.glb` file under 8 MB. Outside texture/file links are rejected. The viewer loads only when that avatar is visible in Live. Google model-viewer's supported-browser details are in its [official project documentation](https://github.com/google/model-viewer).
9. **Stop voice** silences generated speech but does not cancel the written answer. **End call** closes realtime WebRTC audio. The complete transcript received from the provider remains available.

### Call while away from home

1. On the computer running HexiGrid, install [Cloudflare's `cloudflared` program](https://developers.cloudflare.com/tunnel/downloads/). A free Quick Tunnel does not need a Cloudflare account.
2. Create an owner passcode in HexiGrid and switch the mode at the top to **Connect**.
3. Open **Settings → Open on another device → Open temporary remote link** and approve it.
4. Copy the temporary address and pairing code to your other device. Open the address, enter the pairing code, then sign in normally.
5. When the call is over, press **Close temporary remote link**. The link also closes when HexiGrid stops.

The temporary link itself is public, so do not post it. Pairing and sign-in protect the app, and sensitive host-only setup actions stay blocked remotely. Cloudflare says Quick Tunnels are for testing and do not have an uptime promise; see its [official Quick Tunnel guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
10. Choose **Save transcript** only when you want to keep the text in local encrypted state. Choose **Record to this device** only when you want a camera/screen recording downloaded to that device; recording stops after 15 minutes or about 250 MB.
11. Choose **Stop media** when finished. Closing the page also releases camera, microphone, screen, and realtime-call tracks.

### Message the actual iLands agent

An iLands agent has a working email address. This gives HexiGrid a simple real-world channel even though camera and WebRTC are provided by HexiGrid rather than the Runner itself.

1. Open **Agents**, edit the agent, and paste their working address into **Agent email**. Do not enter the agent's password.
2. Open **Live** and select that agent.
3. Under **Message the actual agent**, write a note and press **Send email**.
4. Pick your Google account in the normal popup and approve Mail access. This happens separately from Google sign-in and backup permission.
5. Press **Check replies**, or **Watch replies** to check every 15 seconds while the page stays open. Replies appear in the live transcript.
6. For a remote call, first create a temporary HTTPS remote link in Settings, then press **Email call link**. Close the remote link when the call is over.

The email action does not replace the selected realtime voice model. It connects the actual agent identity to the session so the agent can receive the invitation and answer through its external tools. Google Mail access is optional, memory-only, and removable with Google disconnect.

If the camera, microphone, screen picker, speech recognition, speech output, or recorder is unavailable, HexiGrid disables or explains that control and keeps text chat usable. Browser support details are available from [MDN camera and microphone](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MDN screen capture](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [MDN speech synthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), and [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).

## Keeping this guide current

Provider-specific in-app content lives in `public/guide-content.js`, separate from application behavior. Any user-facing connection, permission, backup, or platform change must update that module and this document in the same change.

## Appearance and button sounds

Open **Settings** to choose **Dark**, **Light**, **Prism**, or **Parchment**. Button sounds are on the first time HexiGrid opens. That setting also controls the short facet-release sounds in the opening animation. Turn **Button sounds** off if you prefer silence. Every sound is created locally by the browser; no audio file or usage information is downloaded or uploaded. If a browser blocks audio before the first interaction, HexiGrid starts the sound system during the button press and never blocks the button action.
