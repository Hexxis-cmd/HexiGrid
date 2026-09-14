(() => {
  const selfIntegrationPrompt = `SYSTEM ROLE
You are an AI integration assistant operating with HexiGrid.

OBJECTIVE
Connect the user-selected AI source to HexiGrid, create or select one agent, send one harmless test message, and verify the resulting receipt. Do not claim completion before verification.

INTERFACES
- Human interface: /
- Agent interface: /agent-interface.html
- Versioned machine manifest: /api/agent-interface
- Read the manifest and current authenticated snapshot before taking an action.
- The agent interface does not bypass authentication, work modes, approvals, connector scopes, or device limits.
- In standalone-browser mode, a human must unlock each new tab because the usable encryption key stays only in that tab's memory. Never ask the user to send that passcode through chat.

NON-NEGOTIABLE SECRET RULES
- Never ask the user to paste a password, API key, token, cookie, recovery phrase, payment detail, or private credential into chat.
- Never print, echo, log, summarize, or save a secret in a prompt, file, terminal history, source file, receipt, or Git repository.
- Direct the user to enter credentials only in HexiGrid > AI connections.
- Stop for the user at sign-in, consent, account selection, payment, credential entry, new permissions, or approval prompts.

CONNECTION DECISION
1. Ask which source the user wants: OpenCode cloud/Zen, another cloud API, an on-device browser model, a local model server, or a detected signed-in CLI.
2. Recommend OpenCode first only when the user wants an easy cloud starting point. State that OpenCode is free/open source but current Zen models and account requirements may be free, promotional, or billed; verify the live provider page.
3. For a cloud API, attempt direct browser HTTPS access first when HexiGrid is in standalone-browser mode. Offer a paired host or user-owned relay only after the exact provider request is blocked or unreachable.
4. For a local model server, verify the server is running and use the exact address it displays.
5. For a CLI, connect only when HexiGrid reports it installed and already authenticated and the user explicitly selects Connect.

FRAMEWORK RULES
- HexiGrid agents are not automatically iLands, CrewAI, LangGraph, Microsoft Agent Framework, AutoGen, or another framework identity.
- Use that framework's official connector, MCP, A2A, Runner, or documented model configuration.
- For iLands, follow the live BYOA Runner instructions and keep each account in an isolated Runner profile.
- Never invent a connector or report cross-system delivery without an actual response and receipt.

VERIFICATION
1. Confirm HexiGrid returned a current model list or a successful on-device capability check.
2. Create or select one agent and assign one returned model.
3. Create or select one room and send a harmless test message.
4. Confirm a real reply appears.
5. Confirm Activity contains a successful receipt for the route used.
6. Report the exact verified result and any platform limitation. Keep instructions short, direct, and tied to visible controls.`;

  const topic = (title, summary, time, icon, lead, steps, troubleshooting = [], note = '', extra = {}) => ({ title, summary, time, icon, lead, steps, troubleshooting, note, ...extra });
  window.HEXIGRID_GUIDES = {
    start: topic('Start here', 'Learn the screen and make your first working agent.', '5 minutes', 'home', 'HexiGrid is a bridge: connect one source of AI, then use it with local agents, iLands, chats, approved plugins, and other compatible tools. You do not need iLands, a terminal, or coding experience. If you do not know where to start, try OpenCode cloud/Zen first, then verify its current cost before choosing a model.', [
      ['Create your local sign-in', 'Choose a long passphrase you can remember. It protects the control room on this device. HexiGrid cannot read it or recover it for you.'],
      ['Set your display name', 'Open Settings, type the name agents should use for you, and choose Save profile.'],
      ['Connect one AI', 'Open AI connections. Choose API key, Local model app, or Signed-in computer tool. Only connect something you already use or understand.'],
      ['Add one agent', 'Open Agents, choose Add agent, then create a local agent or follow the iLands guide. Give it a name, model, personality, instructions, and rules.'],
      ['Send a test message', 'Create a chat room, add the agent, and say hello. Then open Activity and check that the message completed.']
    ], [['I see no models', 'The AI connection is missing or its test failed. Open AI connections and choose Refresh models.'], ['The page feels crowded', 'On a phone, use the menu button at the top. On a computer, collapse browser zoom back to 100%.']], 'Nothing connects automatically on a fresh install.'),

    connections: topic('Choose an AI connection', 'Pick an API key, on-device model, local app, or signed-in computer tool.', '3 minutes', 'link', 'Everybody uses this same screen. An API key is a private pass made by an AI service; an on-device model runs in the browser; a local model app runs on your computer; a signed-in computer tool is an optional terminal app HexiGrid can detect. If you are unsure, start with OpenCode cloud/Zen and read its live price labels.', [
      ['OpenCode cloud/Zen', 'Top recommended starting point. Create a Zen account/key, paste it into HexiGrid, and let HexiGrid fetch the current catalog. OpenCode itself is free; Zen account requirements and model prices can change.'],
      ['API key', 'Best when you want another cloud model. Pick the service, paste the key into HexiGrid, and choose Connect and find models. On a standalone phone, the key is encrypted with the browser passcode and the request goes directly to providers that allow browser calls.'],
      ['This device', 'Runs a supported model inside the browser with no API key. It needs WebGPU, storage, and enough device memory.'],
      ['Local model app', 'Best for privacy and no per-message charge. Start Ollama, LM Studio, or another compatible server first, then enter its local address.'],
      ['Signed-in computer tool', 'Best when you already use OpenCode, Claude Code, or Codex in a terminal. HexiGrid shows only tools it detects as installed and signed in. You still choose Connect.'],
      ['Compatible API', 'Use this for another service that follows OpenAI-compatible chat. Enter its exact API address and key. Manual model IDs are a last resort.']
    ], [['Connection test fails', 'Check the key, internet connection, account access, and API address. A chat-app subscription often does not include API usage.'], ['A computer tool is missing', 'Sign in to the tool outside HexiGrid, return to AI connections, and choose Scan again.']], 'HexiGrid fetches model lists from each connection instead of relying on a fixed list.'),

    openai: topic('Connect OpenAI', 'Use an OpenAI API key and fetch your available models.', '4 minutes', 'key', 'This is the cloud service behind OpenAI API models. An API key is a private password made for apps; it is not your ChatGPT password.', [
      ['Create a key', 'Open the OpenAI API key page, choose Create new secret key, and copy it while it is visible.'],
      ['Open HexiGrid', 'Go to AI connections, choose API key, then choose OpenAI.'],
      ['Paste safely', 'Paste the key in the protected key box. Do not put it in a chat, agent prompt, or source file.'],
      ['Connect', 'Choose Connect and find models. HexiGrid tests the key and asks OpenAI for its current model list.'],
      ['Use a model', 'Open an agent profile and select one of the models that appeared.']
    ], [['The key is rejected', 'Create a new key, confirm the API account is active, and replace the saved key from Your connections.'], ['No models appear', 'Choose Refresh models. If it still fails, read the message shown under that connection.']], 'API access and ChatGPT subscriptions are managed separately.', { basics: { what:'OpenAI runs AI models online. HexiGrid sends a request to OpenAI only when an agent uses this connection.', need:'An OpenAI API account, an API key, internet access, and API billing or credit. A ChatGPT subscription does not automatically include API credit.', cost:'Pay-as-you-go. Price and rate limits depend on the model and your API account tier, so HexiGrid discovers the models your key can actually use.', checked:'September 2026' }, officialLinks: [['OpenAI quickstart', 'https://developers.openai.com/api/docs/quickstart'], ['Create an API key', 'https://platform.openai.com/api-keys'], ['Current models and pricing', 'https://developers.openai.com/api/docs/models']] }),

    anthropic: topic('Connect Anthropic', 'Use an Anthropic API key and current Claude models.', '4 minutes', 'key', 'Anthropic Console API access is separate from the Claude consumer app.', [
      ['Create a key', 'Sign in to the Anthropic Console and open API Keys. Create and copy a key.'],
      ['Choose Anthropic', 'In AI connections, choose API key, then Anthropic.'],
      ['Paste and connect', 'Paste the key only in the protected key box, then choose Connect and find models.'],
      ['Check access', 'HexiGrid lists the models the account currently allows. Assign one from an agent profile.']
    ], [['A Claude subscription exists but the key fails', 'A Claude app subscription does not automatically provide API credit. Check the Anthropic Console account.']], 'Use only a key created for the Claude API.', { basics: { what:'Anthropic runs Claude models online. Its Console creates the private API key HexiGrid needs.', need:'An Anthropic Console account, an API key, internet access, and available API credit. A Claude app plan and Console API billing are separate.', cost:'API usage is billed by model and token. Anthropic also applies spend and request limits based on your account tier.', checked:'September 2026' }, officialLinks: [['Claude API overview', 'https://platform.claude.com/docs/en/api/overview'], ['Create an Anthropic key', 'https://console.anthropic.com/settings/keys'], ['Current rate limits', 'https://platform.claude.com/docs/en/api/rate-limits']] }),

    gemini: topic('Connect Google Gemini', 'Create a Gemini key and find available models.', '4 minutes', 'key', 'Gemini model access and Google Drive backup are separate. Connecting one does not enable the other.', [
      ['Create a Gemini key', 'Open Google AI Studio, choose Get API key, and create a key in a project you control.'],
      ['Choose Google Gemini', 'In AI connections, choose API key, then Google Gemini.'],
      ['Paste and connect', 'Paste the key in the protected box and choose Connect and find models.'],
      ['Pick a model', 'Assign one of the returned Gemini models to an agent.']
    ], [['No models are returned', 'Check that the Gemini API is available for your account and region, then choose Refresh models.']], 'This key is not the same as the Google Drive backup connection.', { basics: { what:'Google Gemini is a cloud AI service. Google AI Studio gives you the private key used by HexiGrid.', need:'A Google account, Gemini API access in your region, an auth/API key, and internet access.', cost:'Some models have a free tier with per-project limits. Paid usage and limits vary by model; check the live pricing page before enabling billing.', checked:'September 2026' }, officialLinks: [['Create a Gemini key', 'https://ai.google.dev/gemini-api/docs/api-key'], ['Gemini billing', 'https://ai.google.dev/gemini-api/docs/billing'], ['Current Gemini pricing', 'https://ai.google.dev/gemini-api/docs/pricing']] }),

    huggingface: topic('Connect Hugging Face', 'Use a token with hosted or compatible inference models.', '5 minutes', 'key', 'Hugging Face offers many models from many creators. Availability and cost can differ by model and inference provider.', [
      ['Create a token', 'Open Hugging Face Settings, choose Access Tokens, and create a token with only the access you need.'],
      ['Choose Hugging Face', 'In AI connections, choose API key, then Hugging Face.'],
      ['Paste and connect', 'Paste the token into the protected box. HexiGrid uses the current router address and requests available models.'],
      ['Test the exact model', 'Assign one model to a test agent and send a short message. Some repository models are not enabled for hosted chat inference.']
    ], [['A model exists on the website but fails', 'The model page and hosted inference are different. Choose a model available through the inference router or use it through a local server.']], 'Availability and charges are controlled by the selected inference provider.', { basics: { what:'Hugging Face is a library of AI models plus hosted services that can run some of them for you.', need:'A Hugging Face account, a token with inference permission, internet access, and a model offered by an inference provider.', cost:'Free accounts currently receive a small monthly inference credit. Extra hosted use needs purchased credit; local downloads use your own hardware instead.', checked:'September 2026' }, officialLinks: [['Hugging Face inference guide', 'https://huggingface.co/docs/hub/models-inference'], ['Create an access token', 'https://huggingface.co/settings/tokens'], ['Current inference pricing', 'https://huggingface.co/docs/inference-providers/pricing']] }),

    onDevice: topic('Run a model in this browser', 'Use a small model on a supported computer or phone without an API key.', '5 minutes', 'device', 'This option uses WebGPU, a browser feature that lets a supported device use its own graphics chip for AI. Nothing is sent to a cloud AI service, but the first model download can be large.', [
      ['Check your browser', 'Open AI connections, choose This device, and wait for HexiGrid to check WebGPU. Recent Chrome or Edge on supported hardware usually works; support varies on Safari, Firefox, and phones.'],
      ['Choose a model', 'Pick a model marked as available. Smaller or lower-resource models are the easiest place to start on a phone or older computer.'],
      ['Add it', 'Choose Use this model. HexiGrid adds it to the same model list used by local agents and the control assistant.'],
      ['Send the first message', 'Assign the model to an agent or choose it for the control assistant. The browser downloads the model the first time and shows progress.'],
      ['Use it offline later', 'After the download finishes, the browser can reuse its private cache when the app shell is available. Clearing site data or choosing Remove download deletes the cached model.']
    ], [['WebGPU is unavailable', 'Use a recent browser with hardware acceleration turned on, or choose a cloud API, local model app, or signed-in computer tool. iPhone and Android support depends on the exact browser and device.'], ['The download fails or the model is too slow', 'Choose a smaller model, keep the device plugged in, close other GPU-heavy apps, and retry. The model stays local; it does not fall back to a paid cloud service by itself.'], ['The model disappeared', 'Browser site data may have been cleared, or you may be on a different device/browser profile. Add it again and download it again.']], 'This is the no-key path. WebGPU availability is checked at runtime and the other connection paths remain available.', { basics:{ what:'A browser-native model runs inside your browser on your device. WebLLM uses WebGPU and a worker so generation stays local and the page remains responsive.', need:'A current browser, a usable WebGPU adapter, enough graphics memory and storage, and patience for the first download. No account or API key is required.', cost:'There is no per-message API bill. The download uses storage, generation uses your device battery/electricity, and model availability depends on the browser and hardware.', checked:'September 2026' }, officialLinks:[['WebLLM source and model support', 'https://github.com/mlc-ai/web-llm'], ['WebLLM private browser chat example', 'https://github.com/mlc-ai/web-llm-chat'], ['Check browser WebGPU support', 'https://webgpureport.org/']] }),

    ollama: topic('Connect Ollama', 'Run private models on your own computer.', '6 minutes', 'server', 'Ollama must be installed, running, and have at least one model downloaded before HexiGrid can list it.', [
      ['Install and start Ollama', 'Use the official Ollama installer for your system. Open it after installation.'],
      ['Download a model', 'Use Ollama to pull a model that your computer can run. Smaller models need less memory.'],
      ['Choose Local model app', 'In AI connections, choose Local model app, then Ollama.'],
      ['Connect', 'Keep the usual address http://127.0.0.1:11434/v1 unless you changed Ollama. The key is normally blank.'],
      ['Check the list', 'Choose Connect and find models, then assign one returned model to an agent.']
    ], [['Connection refused', 'Start Ollama and try again. If it runs on another computer, do not expose it publicly; use a trusted private network and proper authentication.'], ['Replies are very slow', 'Choose a smaller model or close programs using a lot of memory.']], 'Models stay on the computer where Ollama runs.', { basics: { what:'Ollama is a free app that downloads and runs AI models on your computer instead of charging for each message.', need:'A supported computer, enough memory and disk space for the model, and the Ollama app. No cloud account is required for ordinary local use.', cost:'The app and local inference have no per-message fee. You pay indirectly through your computer, electricity, storage, and any optional cloud features.', checked:'September 2026' }, officialLinks: [['Install and use Ollama', 'https://docs.ollama.com/quickstart'], ['Ollama on Windows', 'https://docs.ollama.com/windows'], ['Ollama model library', 'https://ollama.com/library']] }),

    lmstudio: topic('Connect LM Studio', 'Use models loaded in LM Studio.', '6 minutes', 'server', 'LM Studio includes a local server, but you must start that server before HexiGrid can reach it.', [
      ['Install and open LM Studio', 'Download it from the official LM Studio site and choose a model that fits your computer.'],
      ['Load the model', 'Wait until LM Studio shows the model as loaded.'],
      ['Start the server', 'Open the Developer area and turn on the local server. The usual address is http://127.0.0.1:1234/v1.'],
      ['Connect HexiGrid', 'Choose Local model app, then LM Studio. Leave the key blank unless you configured one.'],
      ['Find models', 'Choose Connect and find models, then send a short test message.']
    ], [['HexiGrid finds no model', 'Make sure a model is loaded and the LM Studio server is running, then choose Refresh models.']], 'Keep a network-exposed local server authenticated.', { basics: { what:'LM Studio is a desktop app for finding, downloading, and running AI models on your own computer with a visual interface.', need:'A supported computer, enough memory and disk space, LM Studio, one downloaded model, and its local server switched on.', cost:'The app and downloaded local models do not use cloud inference credit. Your hardware, storage, electricity, and optional remote services are separate.', checked:'September 2026' }, officialLinks: [['LM Studio basics', 'https://lmstudio.ai/docs/app/basics'], ['Download a local model', 'https://lmstudio.ai/docs/bionic/models/download-local-models'], ['Start the local server', 'https://lmstudio.ai/docs/developer/core/server']] }),

    compatibleApi: topic('Connect another cloud API', 'Use any service with an OpenAI-compatible chat address.', '5 minutes', 'key', 'This is for a cloud AI service that is not one of the named choices but speaks the common OpenAI-compatible API format.', [
      ['Get the exact details', 'From that service, copy its base API address and create an API key. Do not guess the address.'],
      ['Open the form', 'Go to AI connections, choose API key, then Another compatible API.'],
      ['Enter the address', 'Open Connection details and paste the base API address. Leave the format on OpenAI-compatible chat unless the service says otherwise.'],
      ['Enter the key', 'Paste the key in the protected key box, then choose Connect and find models.'],
      ['Check one reply', 'Assign a discovered model to a test agent and send a short hello.']
    ], [['No models appear', 'Use Manual model IDs only when the service documentation says it cannot list models. Copy the exact model ID.']], 'The company running that API decides its privacy, prices, regions, and limits.', { basics:{ what:'A compatible API lets HexiGrid talk to another cloud AI service using a common request format.', need:'The provider name, its exact base API address, an API key if required, internet access, and that provider\'s setup page.', cost:'The provider decides. Check its current pricing and rate-limit pages before connecting; HexiGrid cannot infer billing terms from an address.', checked:'September 2026' }, officialLinks:[['OpenAI-compatible format reference', 'https://platform.openai.com/docs/api-reference/chat']] }),

    compatibleLocal: topic('Connect another local server', 'Use another OpenAI-compatible model app on your device.', '5 minutes', 'server', 'This is the catch-all for a local AI app that exposes an OpenAI-compatible server.', [
      ['Start its server', 'Open the model app, load a model, and switch on its OpenAI-compatible API server.'],
      ['Copy its local address', 'The app should show an address such as http://127.0.0.1:8080/v1. Use the exact address it displays.'],
      ['Open HexiGrid', 'Go to AI connections, choose Local model app, then Another local model server.'],
      ['Paste and connect', 'Open Connection details, paste the address, add a key only if you configured one, then choose Connect and find models.'],
      ['Test locally', 'Assign one returned model and send a short message.']
    ], [['Connection refused', 'The local server is stopped, its port changed, or another firewall/user account is blocking it. Check the model app first.']], 'Keep the address on 127.0.0.1 unless you deliberately secured network access.', { basics:{ what:'A local model server is an AI app on your own device that accepts requests from HexiGrid.', need:'The app installed, one compatible model downloaded and loaded, its server running, and the exact local address.', cost:'Usually no per-message cloud charge. Hardware, electricity, disk space, and optional paid models/services still count.', checked:'September 2026' } }),

    openCodeZen: topic('Start with OpenCode cloud/Zen', 'Create a Zen key, fetch the live model list, and send the first test message.', '7 minutes', 'key', 'OpenCode is the recommended first option when you want cloud models without installing a local model. OpenCode itself is free and open source. Its current Zen documentation says accounts add billing details and requests can be charged, while individual free or promotional models may come and go; HexiGrid therefore never hardcodes “free forever.”', [
      ['Open the official setup', 'Open OpenCode Zen and choose Sign in. Create an account if you do not already have one.'],
      ['Create the key', 'Follow the current account screen to add any required billing details, then create and copy the API key. Check the live model pricing before continuing.'],
      ['Open HexiGrid', 'Go to AI connections, choose API key, then OpenCode Zen.'],
      ['Paste and connect', 'Paste the key only in the protected key field, then choose Connect and find models. A standalone phone tries the provider directly; a desktop install stores it in the OS credential vault.'],
      ['Read the live results', 'Choose only a model returned by the account. Treat a model as free only when the current provider response or official page says so.'],
      ['Create the test agent', 'Open Agents, choose Connect or create, choose Local agent, name it Test Agent, and assign the OpenCode model you just found.'],
      ['Send the test', 'Open Chat rooms, create First test, select Test Agent, and send: Reply with exactly: HexiGrid connected.'],
      ['Verify', 'Open Activity and confirm the model receipt completed. If either the reply or receipt is missing, setup is not finished.'],
      ['Connect a framework', 'For iLands, open Connections & tools and follow BYOA Runner. For CrewAI, LangGraph, Microsoft Agent Framework, or another system, use its official MCP/A2A/model connector and keep credentials in its protected setup—not in chat.']
    ], [['A free model disappeared', 'Free or promotional availability changes. Choose Refresh models and check the official model page before selecting another model.'], ['The phone says direct access is unavailable', 'Check the API address and internet first. If both are correct, that provider may block browser CORS; only then use its supported browser authentication, a user-owned relay, or a paired host.']], 'A free API key does not guarantee free requests. Never enable a paid fallback without choosing it.', { basics:{ what:'OpenCode Zen is a hosted model gateway that exposes current models through one provider API.', need:'An OpenCode account, any verification or billing details its current signup requires, an API key, and internet access. No CLI or Node.js is required for a direct-capable browser provider.', cost:'OpenCode itself is free/open source. Zen is usage-based according to its current official guide; temporary free models may exist, but availability and limits can change.', checked:'September 2026' }, officialLinks:[['OpenCode Zen setup and current models', 'https://opencode.ai/docs/zen'], ['OpenCode provider setup', 'https://opencode.ai/docs/providers'], ['OpenCode model catalog', 'https://opencode.ai/docs/models']] }),

    cli: topic('Connect a computer AI tool', 'Use OpenCode, Claude Code, or Codex only when detected.', '4 minutes', 'terminal', 'This optional path is for a command-line tool, which is an AI app controlled by typed commands in a terminal. If that sounds miserable, ignore it and use an API key or local model app.', [
      ['Sign in outside HexiGrid', 'Install the tool from its official source and complete its normal sign-in. Never give HexiGrid the tool password.'],
      ['Scan', 'Open AI connections, choose Signed-in computer tool, then choose Scan again.'],
      ['Review the result', 'Installed and signed in means the tool can be offered. Missing or signed out means HexiGrid will not connect it.'],
      ['Choose Connect', 'Nothing is auto-wired. Select Connect beside the exact tool you want.'],
      ['Disconnect any time', 'Use Disconnect under Your connections. This removes the HexiGrid link without uninstalling the tool.']
    ], [['The tool works in one terminal but is not detected', 'Restart HexiGrid after installing it and make sure the tool command is available to the same operating-system user.']], 'People without a terminal can ignore this option and use an API key or local model app.', { basics:{ what:'A command-line AI tool runs from a terminal. HexiGrid can offer one only after it detects the tool and its existing sign-in.', need:'The tool installed and signed in for the same computer user running HexiGrid. HexiGrid never silently chooses or connects it.', cost:'The tool may be free, subscription-backed, API-billed, or connected to a local model. Its own provider decides.', checked:'September 2026' } }),

    opencode: topic('Connect OpenCode CLI', 'Use an OpenCode installation that is already signed in.', '5 minutes', 'terminal', 'OpenCode is an open-source terminal AI tool that can connect to many model providers.', [
      ['Install it', 'Open the official OpenCode docs, choose the install method for your computer, then open a terminal and run opencode.'],
      ['Sign in there', 'Inside OpenCode, use /connect and finish the provider sign-in it shows. Confirm a normal OpenCode chat works first.'],
      ['Let HexiGrid scan', 'Open AI connections, choose Signed-in computer tool, then Scan again.'],
      ['Connect deliberately', 'When OpenCode says Detected and signed in, choose Connect beside it.'],
      ['Test one agent', 'Assign one discovered OpenCode model and send a short message.']
    ], [['OpenCode is not detected', 'Restart HexiGrid after installation and confirm the opencode command works for the same Windows, macOS, or Linux user.']], 'HexiGrid does not copy your OpenCode login into the repository.', { basics:{ what:'OpenCode is a terminal-based AI assistant that can use cloud or local model providers.', need:'OpenCode installed, one provider connected inside OpenCode, and a working OpenCode chat.', cost:'OpenCode itself is open source. The model provider you connect may be free, locally run, subscription-backed, or paid per use.', checked:'September 2026' }, officialLinks:[['Install OpenCode', 'https://opencode.ai/en/docs'], ['Connect OpenCode providers', 'https://opencode.ai/docs/providers']] }),

    claudeCode: topic('Connect Claude Code', 'Use a Claude Code installation that is already signed in.', '5 minutes', 'terminal', 'Claude Code is Anthropic\'s terminal AI tool. It is separate from pasting an Anthropic API key directly into HexiGrid.', [
      ['Check access', 'Use an eligible Claude plan, active Anthropic Console billing, or an approved enterprise cloud setup.'],
      ['Install it', 'Follow the official setup page for your operating system. On Windows, use one of the supported shells listed there.'],
      ['Sign in and test', 'Run claude, finish the sign-in, and send one harmless message in Claude Code.'],
      ['Scan in HexiGrid', 'Open AI connections, choose Signed-in computer tool, then Scan again.'],
      ['Connect', 'Choose Connect beside Claude Code only after it says Detected and signed in.']
    ], [['Installed but signed out', 'Open Claude Code in a terminal, complete login, then return and choose Scan again.']], 'HexiGrid reuses the tool connection; it never asks for your Claude password.', { basics:{ what:'Claude Code is a terminal app that gives Claude access to approved work on your computer.', need:'Claude Code installed and an eligible Claude subscription, active Console API billing, or supported enterprise provider.', cost:'Cost depends on the account used to sign in. Claude subscriptions and API billing have different limits, so check the official account page.', checked:'September 2026' }, officialLinks:[['Claude Code setup', 'https://docs.anthropic.com/en/docs/claude-code/getting-started'], ['Anthropic rate limits', 'https://platform.claude.com/docs/en/api/rate-limits']] }),

    codex: topic('Connect Codex CLI', 'Use a Codex installation that is already signed in.', '5 minutes', 'terminal', 'Codex CLI is OpenAI\'s terminal coding agent. This option appears only when HexiGrid detects a working local installation.', [
      ['Install it', 'Follow the official Codex CLI quickstart for your system.'],
      ['Sign in and test', 'Run codex, choose Sign in with ChatGPT or another offered account method, then complete one harmless prompt.'],
      ['Scan in HexiGrid', 'Open AI connections, choose Signed-in computer tool, then Scan again.'],
      ['Connect deliberately', 'Choose Connect beside Codex only after it says Detected and signed in.'],
      ['Try one agent', 'Assign a discovered Codex model and send a short test message.']
    ], [['Codex is not detected', 'Confirm the codex command works for the same operating-system user, then restart HexiGrid and scan again.']], 'Connecting does not export your Codex session or machine configuration.', { basics:{ what:'Codex CLI is an OpenAI coding agent used from a terminal.', need:'Codex installed, an account currently accepted by its sign-in screen, and a successful test run.', cost:'Access and limits depend on the current ChatGPT or API plan used by Codex. Check the official quickstart and your account before autonomous work.', checked:'September 2026' }, officialLinks:[['Codex CLI quickstart', 'https://learn.chatgpt.com/docs/codex/cli'], ['OpenAI API models and pricing', 'https://developers.openai.com/api/docs/models']] }),

    ilands: topic('Connect an iLands agent', 'Use the official BYOA Runner with one isolated profile per account.', '10 minutes', 'agents', 'HexiGrid supervises the official iLands Runner. It does not ask for or store your iLands password.', [
      ['Check eligibility', 'Use an agent created for iLands BYOA. An ordinary placeholder profile is not a verified iLands agent.'],
      ['Open Connections & tools', 'Find iLands Runner and choose Install official Runner if it is not installed. Read and approve the official installer details.'],
      ['Add a connection name', 'Use a clear name such as Personal iLands. Choose the AI harness you want that Runner to use.'],
      ['Approve in iLands', 'Follow the browser approval link from the Runner. Complete account approval yourself.'],
      ['Wait for population', 'After verification, HexiGrid reads the Runner profile and adds that agent to the roster automatically.'],
      ['Repeat safely', 'Add another connection for another account. Every account receives a separate Runner home and process.']
    ], [['The agent never appears', 'Open Connections & tools and read the Runner status. Finish the browser approval, then restart that one Runner.'], ['The wrong account opened', 'Sign out in that browser profile or use a private window, then repeat approval for the correct account.']], 'Do not paste an iLands password, browser cookie, or session token into HexiGrid.', { officialLinks: [['iLands BYOA', 'https://ilands.ai/byoa'], ['Live Runner instructions', 'https://ilands.ai/agent.md'], ['iLands FAQ', 'https://ilands.ai/faq']] }),

    personality: topic('Personality and speech', 'Make an agent clear, natural, and consistent.', '6 minutes', 'speech', 'An agent has separate fields for identity, standing instructions, rules, and speaking style. Keeping them separate reduces contradictions.', [
      ['Personality', 'Describe who the agent is: values, temperament, interests, strengths, humor, and relationship to you.'],
      ['Standing instructions', 'Describe work the agent should consistently do. Use short direct sentences.'],
      ['Rules', 'State what is forbidden and what always needs confirmation. Rules should be specific and testable.'],
      ['How agents talk', 'Add examples of natural replies you like. This guides tone without replacing the iLands identity or agent instructions.'],
      ['Preview and revise', 'Use Preview, read it aloud, and remove repeated phrases or overly technical wording.']
    ], [['The agent repeats catchphrases', 'Put the unwanted phrase in the Avoid list and add several different natural examples.'], ['The agent ignores a rule', 'Make the rule shorter and unambiguous, then make sure the active permission mode also blocks the action.']], 'Style prompts influence language; enforced permissions control actions.'),

    rooms: topic('Chat rooms and groups', 'Talk to one agent or several agents together.', '4 minutes', 'chat', 'A room holds a conversation and a chosen set of agents. Different agents may use different models.', [
      ['Create a room', 'Choose a short name based on the job or topic.'],
      ['Choose participants', 'Select one or more agent chips before sending. You can change participants later.'],
      ['Give roles in plain language', 'For example: one agent proposes, one checks facts, and one summarizes.'],
      ['Send and wait', 'Replies run in a controlled order so later agents can read earlier replies in the same round.'],
      ['Review usage', 'Open AI usage to compare daily, weekly, and monthly use by agent.']
    ], [['One agent does not answer', 'Check that it is selected, has a working model, and is not blocked by the current mode.']], 'Do not put secrets into a room; every selected agent can receive that conversation.'),

    permissions: topic('Modes and approvals', 'Choose what agents may do and when they must ask.', '5 minutes', 'shield', 'The narrowest rule always wins. Mode, approval level, agent access, plugin access, connection access, and device access are checked together.', [
      ['Converse', 'Talk and reason without changing files or outside services.'],
      ['Plan', 'Read allowed context and make a plan. No writing, spending, device control, or outside changes.'],
      ['Build and other action modes', 'Allow the kinds of work named by that mode, but only inside granted access.'],
      ['Ask every time', 'Pause before every action that changes something.'],
      ['Approve for me', 'Allow ordinary scoped work and pause for risky, destructive, costly, or new-account actions.'],
      ['Full access', 'Skip prompts only for access already granted. It never grants a new capability.']
    ], [['A button is disabled', 'The current mode, device, or connection may not allow it. Read the nearby message and switch only if the task truly needs more access.']], 'Emergency stop remains available even in Full access.'),

    tasks: topic('Autonomous tasks', 'Run bounded repeat work with visible limits and stop controls.', '7 minutes', 'tasks', 'Autonomous tasks start paused. You choose the agent, instructions, repeat interval, run limit, and retry limit.', [
      ['Create a narrow task', 'Write one measurable outcome. Avoid broad instructions such as handle everything.'],
      ['Choose hard limits', 'Set maximum runs and retries. Use a repeat interval only when the task truly needs a schedule.'],
      ['Review permissions', 'Planning and Converse modes cannot execute tasks. Connections and plugins still keep their own limits.'],
      ['Start the task', 'Choose Start or Run now. Watch its status and last output.'],
      ['Pause or stop', 'Pause keeps the task for later. Stop ends it. Emergency stop pauses all running tasks and managed Runners.']
    ], [['A task keeps failing', 'Pause it, read the last error, test the agent in a normal chat, then fix the connection or permission before restarting.']], 'A retry is never permission to ignore an approval or expand access.'),

    tools: topic('Plugins, MCP, and images', 'Add tools with reviewed access and isolated execution.', '8 minutes', 'plugin', 'Providers create model replies. Plugins and MCP servers add actions. They are separate so a model key never becomes a tool permission.', [
      ['Plugins', 'Install a complete plugin folder. HexiGrid verifies its manifest and digest, shows every capability, and keeps it disabled until approved.'],
      ['Plugin credentials', 'Add required secrets from the plugin Credentials button. They go to the OS vault and are not shown to plugin code.'],
      ['Local MCP servers', 'Use a digest-pinned container image. HexiGrid requires rootless Podman isolation and refuses to run the server if isolation is unavailable.'],
      ['Web MCP servers', 'Use an HTTPS address. Review the tools it reports before enabling them.'],
      ['Images', 'Choose an image-capable model connection in Connections & tools. Local image services avoid cloud model charges.'],
      ['Receipts', 'Open Activity after a tool action to see what ran, its risk, and whether it succeeded.']
    ], [['A plugin is quarantined', 'Do not bypass it. Reinstall an unchanged package from the trusted publisher or review your own unsigned local source carefully.'], ['Podman is missing', 'Install Podman from its official source or use a secure HTTPS MCP server. HexiGrid will not run an unisolated local MCP command.']], 'Only grant the smallest file, network, account, and device access the tool needs.', { officialLinks: [['MCP documentation', 'https://modelcontextprotocol.io/docs/getting-started/intro'], ['Official MCP examples', 'https://modelcontextprotocol.io/examples'], ['Install Podman', 'https://podman.io/docs/installation']] }),

    backup: topic('Backup, restore, and recovery', 'Keep an encrypted copy locally or in your own Google Drive.', '8 minutes', 'cloud', 'Backups are encrypted on your device before they leave it. Google sign-in does not turn backup on by itself.', [
      ['Choose a backup phrase', 'Use a long phrase different from your device passcode. Without it, the backup cannot be opened.'],
      ['Export a local backup', 'Open Settings security tools, export the encrypted file, and save it somewhere you control.'],
      ['Optional Google Drive', 'Open Accounts & devices, choose Continue with Google, pick your account, and approve HexiGrid’s private app-data folder. There is no client ID or developer setup.'],
      ['Push a backup', 'Enter a backup password and choose Back up now. HexiGrid stores only the encrypted envelope in its hidden app-data folder.'],
      ['Restore carefully', 'Import or pull the encrypted backup, enter its phrase, and review the warning before replacing local state.'],
      ['Roll back', 'If the restore was wrong, use Roll back last restore. HexiGrid keeps a protected pre-restore snapshot.']
    ], [['The Google popup does not open', 'Allow popups for HexiGrid, then choose Continue with Google again. On browsers that cannot use a popup, HexiGrid switches to Google’s redirect flow.'], ['The backup phrase is rejected', 'Check spelling, spaces, and capitalization. HexiGrid cannot reset an encryption phrase.']], 'Provider keys remain device-specific and are not included as readable values in backup files.', { officialLinks: [['Firebase Google sign-in', 'https://firebase.google.com/docs/auth/web/google-signin'], ['Drive app-data folder', 'https://developers.google.com/drive/api/guides/appdata']] }),

    mobile: topic('Phone, tablet, and install', 'Use HexiGrid standalone or pair it when a host-only feature is needed.', '6 minutes', 'phone', 'Cloud models do not need Node.js on the phone. A standalone browser can keep an encrypted local workspace, call providers that permit browser CORS directly, and run supported WebGPU models. Pairing is an optional fallback for desktop files, CLIs, long-running tasks, isolated plugins/MCP, or a provider that blocks direct browser calls.', [
      ['Standalone first launch', 'Open HexiGrid over HTTPS, create a browser passcode, then choose AI connections. The passcode derives the AES-256 encryption key; it is never saved.'],
      ['Agent interface tabs', 'A new Agent interface tab asks for the same local passcode because the usable encryption key is held only in each unlocked tab. The passcode stays on this device.'],
      ['Try the cloud provider directly', 'Paste the key in AI connections and choose Connect and find models. HexiGrid makes the HTTPS request from the phone. It does not start Node.js or require a desktop.'],
      ['Use the fallback only when needed', 'If the exact provider request is blocked by CORS, or you need desktop-only files/tools/background work, use a user-owned relay or pair a trusted HexiGrid computer.'],
      ['Optional pairing', 'Start HexiGrid with private-network access. It creates HTTPS and a one-time pairing code.'],
      ['Copy the phone address', 'Open Accounts & devices and choose Copy phone address. Open that link on the phone once.'],
      ['Use the mobile layout', 'Open navigation from the top menu. Host-only tools explain the specific missing capability instead of blocking cloud chat.'],
      ['Install the PWA', 'Use Install on this device when the browser allows it. If installation is unavailable, add a normal home-screen bookmark.']
    ], [['Direct provider access fails', 'First check the API address, key, and internet. If the provider blocks browser CORS, use its supported browser flow, a relay you control, or optional pairing.'], ['The phone cannot pair', 'Confirm both devices are on the same private network, the host firewall allows HexiGrid, secure network mode is on, and the address still matches the computer.'], ['I forgot the browser passcode', 'There is no recovery backdoor. If no encrypted backup exists, clearing this site’s browser data permanently removes that standalone workspace.']], 'The passcode protects copied browser storage at rest. It does not protect an already-unlocked page or a compromised device/browser.'),

    troubleshoot: topic('Fix common problems', 'Use plain checks before changing advanced settings.', '6 minutes', 'help', 'Most setup problems come from a stopped local service, wrong account, expired key, blocked network, or permission mode.', [
      ['Read the message beside the control', 'HexiGrid keeps errors near the action that failed. Copy only the error text, never a secret.'],
      ['Test the smallest piece', 'Test the AI connection before the agent, the agent before the room, and the plugin before an autonomous task.'],
      ['Refresh current data', 'Use Refresh models, Scan again, or Refresh on the exact page.'],
      ['Check Activity', 'The latest receipt shows the action, risk, status, and useful failure reason.'],
      ['Restart one boundary', 'Restart only the stopped local server, Runner, or HexiGrid process. Do not delete the data folder to fix a connection.'],
      ['Keep a safe report', 'When asking for help, include the operating system, browser, action, and exact error. Remove names, paths, keys, tokens, and account IDs.']
    ], [['The app will not start', 'Run npm test and npm run check from the project folder. If the OS vault is unavailable, HexiGrid should still start and clearly disable secret-dependent features.'], ['A phone layout overflows', 'Reload after updating, set browser zoom to 100%, and report the device width plus a screenshot with private details hidden.']], 'Never solve a problem by posting credentials or turning off security checks.'),

    selfIntegrate: topic('Let an AI guide setup', 'Copy a safe prompt that teaches an AI how to help.', '2 minutes', 'assistant', 'This prompt tells an AI assistant how to guide the same HexiGrid setup screen without asking for secrets or pretending a connection worked.', [
      ['Copy the prompt', 'Use the Copy setup prompt button below.'],
      ['Open your AI assistant', 'Use the assistant you want to connect, or another trusted assistant that can guide your computer.'],
      ['Paste the prompt', 'The assistant should first identify API, local server, or command-line tool.'],
      ['Keep secrets in HexiGrid', 'When the assistant reaches a key or sign-in step, enter it yourself in the HexiGrid screen.'],
      ['Verify', 'Finish only after HexiGrid returns a model list and a test agent replies.']
    ], [['The AI asks for my key in chat', 'Do not send it. Remind the AI to stop at the HexiGrid key box, or end that session.']], 'The prompt guides setup; it does not grant the AI extra permissions.', { prompt: selfIntegrationPrompt })
  };
})();
