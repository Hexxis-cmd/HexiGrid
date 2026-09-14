# HexiGrid project rules

HexiGrid is a local-first, provider-neutral home for humans and AI agents. It is not an iLands clone and it is not primarily a coding IDE. iLands is the first agent-account connector; OpenCode is the first local model connector.

## Product invariants

- Develop directly on `main` unless the owner changes this rule.
- Do not publish, deploy, announce, or onboard outside users until the owner has personally tested and approved the complete product.
- Do not require a paid service. Optional paid model or service connectors may exist, but every core workflow needs a no-cost/local path.
- Raw chats, memories, credentials, account sessions, files, and audit details remain local by default.
- Google sign-in is identity, not permission to upload private data. Google Drive backup must be separately enabled and client-side encrypted before leaving a device.
- Store secrets in an OS-backed credential vault. Never put secrets in Git, logs, prompts, exports, analytics, or ordinary JSON state.
- Every external action must pass the effective policy intersection: work mode, approval profile, agent grants, plugin scopes, connector scopes, and device scopes.
- `Full access` removes per-action prompts only inside those scopes. It does not grant new scopes or override the active work mode.
- Planning mode is read-and-plan only. It cannot write files, call mutating tools, spawn acting subagents, spend money, or change external state.
- Human-readable action receipts and revocation must exist for every connector and plugin.
- Support any number of agents, accounts, model providers, rooms, devices, and workspaces. Never encode a limit of three.

## Engineering rules

- Prefer small provider/connector interfaces over hard-coded vendor behavior.
- Separate policy decisions from execution. Every tool call needs a declarative capability and risk classification before dispatch.
- Treat plugins, MCP servers, A2A peers, browser automation, robots, finance tools, and model backends as untrusted boundaries.
- Make migrations reversible and preserve local user data.
- Add tests for policy, encryption boundaries, connector isolation, and destructive operations.
- Keep the product renameable through centralized brand constants and neutral internal identifiers.
