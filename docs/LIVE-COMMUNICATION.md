# Live communication

HexiGrid's live view is a local, one-agent-at-a-time session. It uses browser permissions only after the owner presses a button:

- Camera and microphone show a local preview. Visual input is not sent unless the owner attaches one frame or separately enables the bounded snapshot stream during a compatible realtime call.
- Screen preview uses the browser's own screen-picker and stays local. It is not computer control.
- **Attach current frame** captures one resized still image from the active camera or screen preview. Only that deliberate snapshot is attached to the next message, and only vision-capable OpenAI-compatible Chat/Responses, Anthropic, or Gemini API models receive it. Text-only and on-device connections refuse the frame clearly.
- **Record to this device** uses the browser's recorder only after a separate click. **Stop & save recording** downloads the result directly to the device; HexiGrid does not upload it or place it in ordinary app state. A recording stops automatically after 15 minutes or roughly 250 MB so one browser tab cannot consume memory forever.
- Speech recognition is attempted only when the owner presses **Start listening**. Browsers that do not provide it can still use the message box.
- Agent replies stay as text and can also be read aloud by a voice already installed in the browser. Voice samples leave the device only when the owner opens the custom-voice creator, selects both files, confirms consent, and approves that provider action.
- **Stop voice** silences speech output only. It does not cancel model work or remove the completed written reply.
- The live transcript stays in memory while the view is open. **Save transcript** stores it in the encrypted local control-room state. If the local host is unavailable, HexiGrid downloads a plain-text copy instead.

The live view intentionally does not pretend that an iLands account is a WebRTC participant. The current public iLands Runner contract provides the BYOA world bridge but no camera, microphone, WebRTC, or dashboard-chat transport. HexiGrid therefore calls the model provider selected by the user and labels that boundary in the interface. If iLands publishes a media transport later, it can be added behind the connector interface without silently scraping an account session.

## Realtime audio calls

Providers that expose an OpenAI-compatible Realtime API can be marked **Realtime voice** when they are connected. The Live page then creates a real WebRTC audio call between the browser and that provider. The owner must press **Start realtime call**, approve provider use when their policy requires it, and grant microphone permission. The long-lived API key remains in the host credential vault; only SDP connection data returns to the browser. **Share live visual context** is a separate, off-by-default control that sends low-detail compressed snapshots from the visible camera or screen preview. It is capped at one frame per second and drops frames while the data channel is busy.

The call works in current desktop and mobile browsers with WebRTC and microphone support. It does not require HexiGrid-hosted signaling or a subscription to HexiGrid, but the selected model provider may charge for realtime usage. Optional visual context is a bounded snapshot stream rather than raw video transport, so it remains understandable, stoppable, and cost-limited across compatible providers.

## Calling from outside the home network

On the host computer, switch to **Connect** mode and choose **Open temporary remote link** in Settings. HexiGrid starts the user-installed `cloudflared` program and shows a random HTTPS address. The other device must enter the rotating pairing code and then the owner's normal sign-in. Closing the link or stopping HexiGrid stops the tunnel; host-only actions such as keys, backups, plugins, MCP, Runner setup, and local harness management remain blocked through it.

This no-account Quick Tunnel path is convenient for temporary calls, but Cloudflare describes it as a development/testing service without an uptime guarantee. For long-running remote access, the owner may configure their own named tunnel outside HexiGrid. [Cloudflare Quick Tunnel guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/) · [Install cloudflared](https://developers.cloudflare.com/tunnel/downloads/)

## Permission behavior

The browser owns the final decision. `getUserMedia()` and `getDisplayMedia()` are feature-detected, requested from a user action, and stopped when the session ends or the page closes. On iOS, Safari may provide fewer speech-recognition voices and may require the page to remain visible; the text composer remains the fallback.

## Voice previews

The voice panel creates three short previews from the voices available on the current device. The previews are actual browser speech output, not canned audio files. Saving a choice stores only the voice name and bounded rate, pitch, and volume settings on the selected agent; a different device may not have the same voice and will fall back to its system voice.

The generated-voice panel is optional. A provider must be explicitly marked as having an OpenAI-compatible `/audio/speech` endpoint. Users enter up to three provider voice names or IDs, generate each preview, and save the chosen voice to one agent. A custom or cloned voice is usable only when the provider has already issued that voice ID with the speaker's permission; HexiGrid does not silently clone or upload a person's voice. Generated clips are temporary, expire after ten minutes on a host, and remain readable as text if audio generation fails or is stopped.

Eligible OpenAI-compatible providers can also create a custom voice from two owner-selected files: the provider-required spoken consent and a clean sample. The operation requires an explicit high-risk approval and a consent checkbox. Each file is limited to 10 MB, forwarded directly to the selected provider, and never written to HexiGrid's state or media directory. If voice creation fails after consent upload, HexiGrid attempts to delete that new consent record. A successful provider voice ID is placed into the existing preview workflow so the owner can listen before assigning it.

## Animated and 3D avatars

Agent profiles accept ordinary PNG/JPEG pictures and small animated GIF/WebP pictures. They can also hold one self-contained GLB 2.0 model under 8 MB. HexiGrid validates the GLB header and embedded scene, rejects references to outside files or URLs, stores it in the local media directory, and includes it in encrypted backups. The 3D renderer is loaded only when a 3D avatar is actually shown, and the selected avatar can rotate or play embedded animation in the Live view on current mobile and desktop browsers. Removing or replacing the avatar removes the prior local model file.
