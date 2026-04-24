# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bitfocus Companion module for controlling Softouch EasyWorship presentation software over TCP. Built on `@companion-module/base` ^1.12.0 (resolves to 1.14.x). Enables remote control of EasyWorship (slides, schedules, media, overlays) through the Companion streaming controller framework.

## Build Commands

```bash
yarn build     # Development build (companion-module-build --dev)
yarn package   # Production build (companion-module-build) — produces softouch-easyworship-<version>.tgz
```

No test or lint commands are configured. Uses Yarn 4.9.1 (pinned via `.yarnrc.yml`, nodeLinker: node-modules — required by companion-module-build; Yarn PnP is not supported).

### Releasing

1. Bump `version` in `package.json` only. `companion/manifest.json` version stays at `"0.0.0"` — the build overrides it from `package.json` when producing the shipped `.tgz`. Do NOT bump the manifest version; leaving it at `0.0.0` matches the generator default and avoids the source/ship drift that got v2.1.0 rejected for a different reason.
2. Tag with **no** `v` prefix (e.g., `git tag -a 2.1.1 -m "2.1.1"`). The repo has a mix of old `v`-prefixed tags and new unprefixed tags; the 2.x-era convention is unprefixed to match what the Bitfocus portal expects.
3. Push commit and tag to origin.
4. Submit version on the Bitfocus Developer Portal (My Connections → Submit Version → select tag).

The build pipeline overrides four manifest fields in the shipped tgz: `version` (from package.json), `runtime.entrypoint` (to `../main.js`, the webpack bundle), `runtime.api`, and `runtime.apiVersion`. Everything else in `companion/manifest.json` ships verbatim — including `maintainers`, `description`, and `shortname`. Fill those in manually; the build does not backfill from `package.json`.

## Architecture

**Entry point:** `src/index.js` — `EasyWorshipInstance` class extends `InstanceBase` from Companion framework. `package.json` `main` and `companion/manifest.json` `runtime.entrypoint` both point at `src/index.js`. Webpack bundles everything (including `@companion-module/base` and `bonjour-service`) into a single `main.js` inside the shipped tgz.

**Module files** (all under `src/`, each exports a factory function that receives the instance as context):
- `config.js` — Configuration field definitions (server selection, client name)
- `actions.js` — 17 command actions (logo, black, clear, slide/schedule navigation, media control, go-to-slide/schedule) plus `buildStatusPayload()` helper and `sendCommand()`
- `feedbacks.js` — 5 boolean feedback states (logo, black, clear, livepreview, connected) + 1 passthrough (`is_none`)
- `variables.js` — 5 variable definitions matching feedback states (includes Connected)
- `presets.js` — UI preset button definitions with embedded PNG images (large file due to base64 PNGs)
- `upgrades.js` — Array of upgrade scripts, passed as the second arg to `runEntrypoint()`. Runs on saved button configs when users upgrade the module. Currently contains one script (`v210_removeDummyOptions`) that strips the orphaned `id_logo`/`id_black`/… dummy options left behind when 15 actions dropped their unused `{ id: '0', label: 'Not used' }` dropdowns.

**Connection lifecycle:**
1. `init()` → try cached server immediately if address/port are saved from a previous session
2. `startDiscovery()` runs in parallel — Bonjour mDNS discovery for `ezwremote._tcp` services
3. `connectTCP()` → TCP socket connection to server
4. Pairing handshake via JSON `connect` command with UUID
5. 30s keepalive heartbeat keeps connection alive; detects dead sockets via TCP send failure
6. `scheduleReconnect()` — single reconnection path on disconnect (1s→5s exponential backoff, never gives up)

**Critical design intent — cached connect vs Bonjour:**
The module connects to the last known server/address/port *immediately* on startup, without waiting for Bonjour. Bonjour runs in parallel for discovering new servers and detecting address changes, but it is NOT a gate for connecting. This is intentional — mDNS can be slow or unreliable, and the common case (same server, same address) should connect in under a second. The `!this.connected` guard in the discovery callback prevents Bonjour from stomping on an already-active connection.

**Key design decisions:**
- TCP data is buffered in `_receiveBuffer` and only parsed on complete `\r\n`-delimited lines (handles stream fragmentation)
- Bonjour instance stored on `this.bonjour` — single persistent instance, do NOT churn/recreate it. The guard `if (this.bonjour) return` in `startDiscovery()` is intentional.
- `updateConfigFields()` must be called after any change to `this.ezw[]` to push dropdown choices to Companion UI
- All socket writes go through `socketSend()` which handles encoding and error logging
- `sendCommand()` validates pairing state and delegates to `socketSend()`; triggers `scheduleReconnect()` if unpaired
- Cleanup is centralized: `destroySocket()`, `stopDiscovery()`, `clearRetry()`, `clearKeepalive()`. The Reconnect (`connectezw`) action calls all four plus `startDiscovery()` — there is NO separate idle timer; earlier code mistakenly called `this.clearIdleTimer()` here and crashed the button.
- EW is silent when idle — this is normal, NOT a failure. Do not treat silence as a dead connection. The keepalive heartbeat handles socket liveness detection.

**Protocol:** All communication is JSON over TCP (`\r\n` delimited). Commands include an `action` field and `requestrev` sequence number. Actions enforce a `paired` check before sending. No formal protocol spec exists — behavior was reverse-engineered from the codebase and confirmed against EW KB articles. `KNOWN_ACTIONS` set defines fully-processed action types; unknown actions still get heartbeat responses for forward compatibility.

## Key Patterns

- **State on instance:** `this.paired`, `this.connected`, `this.socket`, `this.ezw[]` (discovered servers), `this.EZWLogo/Black/Clear/LivePreview`
- **Factory exports:** Each module file exports a function (e.g., `getPresets(instance)`, `actions()`) — not classes
- **Bonjour discovery:** Servers found via mDNS are stored in `this.ezw[]` and presented as config dropdown choices via `updateConfigFields()`
- **Cached server on startup:** `this.ezw` is seeded with the saved server name in `init()` so the dropdown has it before Bonjour discovers anything
- **Status payload:** Logo, black, and clear actions share `buildStatusPayload()` in `actions.js` to construct the 14-field status command
- **Reconnection:** One path only — `scheduleReconnect()` → retries `connectTCP()` or restarts discovery if address is unknown
- **Config fields:** Use `default:` not `value:` for textinput initial values — Companion calls `.trim()` on values and will throw on undefined. `static-text` fields do use `value:` (they're display-only).
- **Upgrade scripts:** Wired via `runEntrypoint(EasyWorshipInstance, UpgradeScripts)` at the bottom of `index.js`. Each script receives `(context, props)` and returns `{ updatedConfig, updatedActions, updatedFeedbacks }` — arrays of mutated entries that Companion persists back into the user's saved button configs.

## Known Constraints

- `@companion-module/tools` declared as ^2.6.1, resolves to 2.7.x. Runs on Node 22 (package.json `engines.node: ">=22"`, manifest `runtime.type: "node22"`). Tools 3.0 is a major bump requiring evaluation.
- `@companion-module/base` declared as ^1.12.0 to satisfy tools' peer dep; resolves to 1.14.x.
- `serialize-javascript` vulnerability (Dependabot alert #13) is in the build-time dependency chain only — does not ship in the module `.tgz`.
- `companion-generate-manifest` produces platform-specific path separators via `path.join()` — hand-verify `runtime.entrypoint` uses forward slashes if ever regenerating on Windows.

## Bitfocus Submission Gotchas (learned the hard way)

- **`maintainers` array is not backfilled from `package.json` author.** The manifest ships verbatim. Must be populated in `companion/manifest.json` directly. v2.1.0 was rejected partly for this.
- **`apiVersion: "0.0.0"` in the source manifest is expected** — build overrides to the real base version.
- **Reviews can take 1.5+ weeks.** Front-load every review bullet before submitting; a second round is another long wait.
