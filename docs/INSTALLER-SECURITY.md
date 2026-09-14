# Installer and launcher security

## Desktop launcher

`Start-Control-Room.ps1` starts HexiGrid with the installed Node.js executable and a literal path to `server.mjs`. It requires Node.js 22 or newer, validates the configured port and package identity, starts the process hidden, and waits for a cryptographically random runtime identity before opening a browser.

The launcher never trusts a listening port by itself. It verifies the HTTP identity, runtime record, owning process, executable name, command line, version, and process ID. If another program owns the port, HexiGrid neither opens it nor stops it. A data-folder lock prevents two HexiGrid server processes from modifying the same encrypted state.

Local mode binds to loopback. Network mode refuses to start without an owner-provided TLS certificate; setup is documented in [SECURE-NETWORK.md](SECURE-NETWORK.md).

## iLands setup handoff

HexiGrid does not pipe internet content into PowerShell, a shell, or Node.js. The dashboard retrieves only the official `https://ilands.ai/agent.md` guide over HTTPS with redirects disabled, a strict text content-type check, a 512 KiB limit, and a 20-second timeout.

Before creating a setup handoff, the server parses the live release, native platform, and certified harness list. It returns a ten-minute, single-use review plan containing the SHA-256 guide fingerprint. At confirmation, it retrieves the guide again and rejects the request if the fingerprint, release, platform, harness, approval details, or expiry changed. The action produces a human-readable receipt.

The final result is an instruction for the official interactive iLands flow. No downloaded command is executed by HexiGrid. On Windows, the owner completes the host PowerShell step required by the official guide. Account authentication remains on the iLands authorization page, and each connected account uses its own Runner profile directory.

## Recovery behavior

Stale runtime records do not authorize a process. The launcher requires a live endpoint and matching operating-system process ownership. A stale data-folder lock is removed only when its recorded process no longer exists. Graceful shutdown removes both files only when they still belong to the current server instance.

## Verification

Automated tests cover malformed and oversized guides, wrong content types, redirects, unsupported platforms and harnesses, guide drift, expired and replayed plans, forbidden remote-code shortcuts, invalid ports, verified startup, existing-instance reuse, duplicate data-folder processes, stale identity data, and foreign listeners.
