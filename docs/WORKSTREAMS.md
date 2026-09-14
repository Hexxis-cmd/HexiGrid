# Implemented product surfaces

This is one product developed on `main`. These entries describe shipped boundaries and extension points; future connectors must not be presented as bundled functionality until they are implemented and tested.

- Product shell: responsive web/PWA, Windows launcher, local service lifecycle, accessibility, onboarding, guide drawer, diagnostics, and mobile capability notices.
- Trust kernel: policy engine, Converse/Plan/Goal/Sketch/Research/Build/Watch modes, approval profiles, receipts, revocation, pause/stop, cancellation, and emergency stop.
- Local vault and recovery: encrypted local state, OS-backed credentials, migration, encrypted import/export, versioned Google Drive ciphertext backups, restore rollback, and recovery codes.
- Agent runtime: provider-neutral profiles, local OpenCode sessions, OpenAI-compatible local/cloud routes, native Anthropic/Responses/Gemini requests, usage metering, memory context, rooms, and bounded tasks.
- iLands boundary: isolated Runner profiles, official install handoff, harness preparation, browser authorization, automatic agent population, service status, managed daemons, and disconnect controls.
- Capability platform: manifest-validated local plugins with schemas and process isolation, plus identity-pinned stdio/HTTPS MCP discovery and invocation with per-tool grants, protected secrets, drift detection, and network/process limits.
- Media: local gallery and provider-backed image generation with local-file storage and receipt tracking.
- Quality gate: `npm run check`, `npm test`, secret exclusion from Git and public state, and explicit platform/dependency boundaries.

Additional services such as robots, browsers, commerce, email, or application-specific automation can be connected through a reviewed plugin or MCP server. They are not silently claimed as bundled adapters.
