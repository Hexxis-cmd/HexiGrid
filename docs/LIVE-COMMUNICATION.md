# Live communication

HexiGrid's live view is a local, one-agent-at-a-time session. It uses browser permissions only after the owner presses a button:

- Camera and microphone show a local preview. Continuous video is not sent to the selected agent.
- Screen preview uses the browser's own screen-picker and stays local. It is not computer control.
- **Attach current frame** captures one resized still image from the active camera or screen preview. Only that deliberate snapshot is attached to the next message, and only vision-capable OpenAI-compatible Chat/Responses, Anthropic, or Gemini API models receive it. Text-only and on-device connections refuse the frame clearly.
- **Record to this device** uses the browser's recorder only after a separate click. **Stop & save recording** downloads the result directly to the device; HexiGrid does not upload it or place it in ordinary app state. A recording stops automatically after 15 minutes or roughly 250 MB so one browser tab cannot consume memory forever.
- Speech recognition is attempted only when the owner presses **Start listening**. Browsers that do not provide it can still use the message box.
- Agent replies stay as text and can also be read aloud by a voice already installed in the browser. The app does not clone or upload voices.
- **Stop voice** silences speech output only. It does not cancel model work or remove the completed written reply.
- The live transcript stays in memory while the view is open. **Save transcript** stores it in the encrypted local control-room state. If the local host is unavailable, HexiGrid downloads a plain-text copy instead.

The live view intentionally does not pretend that an iLands account is a WebRTC participant or that a model watches continuous local video. iLands Runner currently provides a separate account bridge, not a public camera/microphone signaling API. Vision is deliberate still-frame input through a compatible model connection.

## Permission behavior

The browser owns the final decision. `getUserMedia()` and `getDisplayMedia()` are feature-detected, requested from a user action, and stopped when the session ends or the page closes. On iOS, Safari may provide fewer speech-recognition voices and may require the page to remain visible; the text composer remains the fallback.

## Voice previews

The voice panel creates three short previews from the voices available on the current device. The previews are actual browser speech output, not canned audio files. Saving a choice stores only the voice name and bounded rate, pitch, and volume settings on the selected agent; a different device may not have the same voice and will fall back to its system voice.

The generated-voice panel is optional. A provider must be explicitly marked as having an OpenAI-compatible `/audio/speech` endpoint. Users enter up to three provider voice names or IDs, generate each preview, and save the chosen voice to one agent. A custom or cloned voice is usable only when the provider has already issued that voice ID with the speaker's permission; HexiGrid does not silently clone or upload a person's voice. Generated clips are temporary, expire after ten minutes on a host, and remain readable as text if audio generation fails or is stopped.
