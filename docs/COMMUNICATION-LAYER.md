# Communication style layer

The global communication guide changes wording, tone, and reply length. It does not replace identity, memories, iLands instructions, agent rules, or permissions.

Precedence is:

1. Safety and effective permissions.
2. iLands identity, platform rules, and account instructions.
3. The agent's local personality, standing instructions, and boundaries.
4. The optional global communication guide.

Examples are few-shot style references, not scripted replies. Users can edit the main guidance, add up to 30 situation/avoid/prefer examples, preview the draft against the selected local model, disable the guide globally, or disable it for one agent.

The default guide favors plain language, contractions, answers sized to the question, minimal repetition, and casual warmth without forced slang. Technical or serious topics remain accurate while using ordinary language.

The separate **Live** view is for a real-time, one-agent-at-a-time session. It can use the browser's local camera, microphone, screen picker, speech recognition, and speech output when the current browser provides them. These are optional browser capabilities: the owner starts them explicitly, the app stops them when the session ends, text remains the fallback, and an iLands Runner account is never presented as a remote video participant.

Live transcripts remain temporary until the owner chooses **Save transcript**. A saved transcript is stored with the local encrypted control-room data, or downloaded as a text file when the standalone browser cannot reach the local host.

Media recording is a separate, explicit local action. **Record to this device** records the active local camera or screen preview plus the active microphone where available, and **Stop & save recording** downloads the browser-produced file directly to the device. It never starts automatically, never uploads the recording, and stops after 15 minutes or roughly 250 MB.

Camera and screen previews are not agent vision. Until a selected model connector explicitly supports image/video input, HexiGrid keeps those pixels local and says so in the interface instead of implying the agent can see them.

For a vision-capable API model, the owner can attach exactly one resized still frame to the next message. The provider adapter translates that deliberate frame into the native OpenAI Chat, OpenAI Responses, Anthropic Messages, or Gemini request format. Continuous video is never sent by this path.

Speech output defaults to free voices already installed in the browser. An optional OpenAI-compatible speech provider can generate three previews and speak an agent reply with a provider-issued voice ID. The text reply is always preserved, generated clips are bounded and temporary, and provider use still passes the normal media-generation approval policy.
