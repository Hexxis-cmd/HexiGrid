# HexiGrid product definition

## One sentence

HexiGrid is a private, local-first control room where a person can bring AI agents from different services, give them models and tools, coordinate them together, and decide exactly what each one may do.

## Launch rule

There is one public launch, not a sequence of public releases. Development still uses internal milestones, test gates, and owner review so the final launch can be complete and dependable. Nothing is considered launch-ready until the owner has personally approved the experience.

## Core experience

1. Sign in locally or with Google, pair trusted devices, and unlock the local vault.
2. Add any number of agents. Import identity/personality from iLands or another service, or create a local agent.
3. Attach one or more model routes: OpenCode, local OpenAI-compatible servers, Ollama, Hugging Face, OpenAI, Anthropic, Google, Azure, or a custom endpoint.
4. Choose a work mode and approval profile before asking the agent to act.
5. Chat one-to-one or in group rooms where agents can address the owner and one another.
6. Grant plugins, MCP servers, apps, browser sessions, files, devices, schedules, image generators, or commerce wallets through scoped permissions.
7. Review live work, approvals, costs, provenance, memory changes, tool receipts, and failures from one control surface.

## Required product areas

- Home: attention queue, active goals, agent health, costs, privacy state, recent receipts.
- Agents: identity, personality, layered instructions, memory, models, tools, schedules, permissions, devices, audit history.
- Rooms: direct and group conversation, turn rules, facilitator modes, shared context, agent-to-agent messages.
- Goals and work: persistent objectives, task graph, parallel subagents, checkpoints, budgets, resumable execution.
- Studio: no-code workflows, prompts, skills, plugins, MCP/A2A connectors, simulations, evaluation sets.
- Models: provider-neutral routing, free-only option, cost/latency/quality policies, fallbacks, local image/audio/video backends.
- Connections: iLands Runner, local and cloud model providers, MCP tool servers, plugins, apps, browsers, email, social accounts, files, robots, game harnesses, and APIs.
- Trust: modes, approval inbox, capability grants, spending envelopes, audit receipts, emergency stop, revocation.
- Memory: profile facts, episodic history, shared room memory, private memory, provenance, confidence, expiry, review and deletion.
- Devices: paired computers/phones/robots with per-device capabilities and presence.
- Settings: local vault, encrypted backup/sync, authentication, diagnostics, imports/exports, accessibility.

## Explicit non-goals

- Scraping private iLands APIs or collecting iLands passwords.
- Pretending a connector can do something its official interface does not support.
- Making cloud storage mandatory.
- Giving an agent an unrestricted bank account or device merely because Full access is selected.
- Binding the architecture to one model vendor, one agent service, or three agents.
