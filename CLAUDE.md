# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bitfocus Companion module for controlling Softouch EasyWorship presentation software over TCP. Built on `@companion-module/base` v1.11.0. Enables remote control of EasyWorship (slides, schedules, media, overlays) through the Companion streaming controller framework.

## Build Commands

```bash
yarn build     # Development build (companion-module-build --dev)
yarn release   # Production build (companion-module-build)
```

No test or lint commands are configured. Uses Yarn 4.9.1 (pinned via `.yarnrc.yml`, nodeLinker: node-modules).

### Releasing

1. Update `version` in `package.json`
2. Tag with `v` prefix (e.g., `git tag -a v2.1.0 -m "v2.1.0"`)
3. Push tag to origin
4. Submit version on the Bitfocus Developer Portal (My Connections → Submit Version → select tag)

`companion/manifest.json` version is optional — the build process overwrites it from `package.json`.

## Architecture

**Entry point:** `index.js` — `EasyWorshipInstance` class extends `InstanceBase` from Companion framework.

**Module files** (each exports a factory function that receives the instance as context):
- `config.js` — Configuration field definitions (server selection, client name)
- `actions.js` — 17 command actions (logo, black, clear, slide/schedule navigation, media control, go-to-slide/schedule) plus `buildStatusPayload()` helper and `sendCommand()`
- `feedbacks.js` — 5 boolean feedback states (logo, black, clear, livepreview, connected) + 1 passthrough (`is_none`)
- `variables.js` — 5 variable definitions matching feedback states (includes Connected)
- `presets.js` — UI preset button definitions with embedded PNG images (large file due to base64 PNGs)

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
- Cleanup is centralized: `destroySocket()`, `stopDiscovery()`, `clearRetry()`, `clearKeepalive()`
- EW is silent when idle — this is normal, NOT a failure. Do not treat silence as a dead connection. The keepalive heartbeat handles socket liveness detection.

**Protocol:** All communication is JSON over TCP (`\r\n` delimited). Commands include an `action` field and `requestrev` sequence number. Actions enforce a `paired` check before sending. No formal protocol spec exists — behavior was reverse-engineered from the codebase and confirmed against EW KB articles. `KNOWN_ACTIONS` set defines fully-processed action types; unknown actions still get heartbeat responses for forward compatibility.

## Key Patterns

- **State on instance:** `this.paired`, `this.connected`, `this.socket`, `this.ezw[]` (discovered servers), `this.EZWLogo/Black/Clear/LivePreview`
- **Factory exports:** Each module file exports a function (e.g., `getPresets(instance)`, `actions()`) — not classes
- **Bonjour discovery:** Servers found via mDNS are stored in `this.ezw[]` and presented as config dropdown choices via `updateConfigFields()`
- **Cached server on startup:** `this.ezw` is seeded with the saved server name in `init()` so the dropdown has it before Bonjour discovers anything
- **Status payload:** Logo, black, and clear actions share `buildStatusPayload()` in `actions.js` to construct the 14-field status command
- **Reconnection:** One path only — `scheduleReconnect()` → retries `connectTCP()` or restarts discovery if address is unknown
- **Config fields:** Use `default:` not `value:` for textinput initial values — Companion calls `.trim()` on values and will throw on undefined

## Known Constraints

- `@companion-module/tools` is pinned at ^2.6.1. Versions 2.7+ have an `eslint-scope` incompatibility with Node 24. Version 3.0 is a major bump requiring evaluation.
- `serialize-javascript` vulnerability (Dependabot alert #13) is in the build-time dependency chain only — does not ship in the module `.tgz`.
- `@companion-module/base` 1.11.3 doesn't satisfy tools' peer dep of `^1.12.0 || ^2.0.0` — builds fine, but be aware if upgrading tools.
