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

## Architecture

**Entry point:** `index.js` — `EasyWorshipInstance` class extends `InstanceBase` from Companion framework.

**Module files** (each exports a factory function that receives the instance as context):
- `config.js` — Configuration field definitions (server selection, client name)
- `actions.js` — 17 command actions (logo, black, clear, slide/schedule navigation, media control, go-to-slide/schedule) plus `buildStatusPayload()` helper and `sendCommand()`
- `feedbacks.js` — 5 boolean feedback states (logo, black, clear, livepreview, connected) + 1 passthrough (`is_none`)
- `variables.js` — 5 variable definitions matching feedback states (includes Connected)
- `presets.js` — UI preset button definitions with embedded PNG images (large file due to base64 PNGs)

**Connection lifecycle:**
1. `init()` → `startDiscovery()` — Bonjour mDNS discovery for `ezwremote._tcp` services
2. `connectTCP()` → TCP socket connection to discovered/configured server
3. Pairing handshake via JSON `connect` command with UUID
4. Status polling via heartbeat; state updates from server push
5. `scheduleReconnect()` — single reconnection path on disconnect (2s→15s exponential backoff, never gives up)
6. Idle timeout (60s) proactively reconnects if EW goes silent

**Key design decisions:**
- TCP data is buffered in `_receiveBuffer` and only parsed on complete `\r\n`-delimited lines (handles stream fragmentation)
- Bonjour instance stored on `this.bonjour` and properly destroyed/recreated via `stopDiscovery()`/`startDiscovery()`
- All socket writes go through `socketSend()` which handles encoding and error logging
- `sendCommand()` validates pairing state and delegates to `socketSend()`; triggers `scheduleReconnect()` if unpaired
- Cleanup is centralized: `destroySocket()`, `stopDiscovery()`, `clearRetry()`

**Protocol:** All communication is JSON over TCP (`\r\n` delimited). Commands include an `action` field and `requestrev` sequence number. Actions enforce a `paired` check before sending. No formal protocol spec exists — behavior was reverse-engineered from the codebase and confirmed against EW KB articles. `KNOWN_ACTIONS` set defines fully-processed action types; unknown actions still get heartbeat responses for forward compatibility.

## Key Patterns

- **State on instance:** `this.paired`, `this.connected`, `this.socket`, `this.ezw[]` (discovered servers), `this.EZWLogo/Black/Clear/LivePreview`
- **Factory exports:** Each module file exports a function (e.g., `getPresets(instance)`, `actions()`) — not classes
- **Bonjour discovery:** Servers found via mDNS are stored in `this.ezw[]` and presented as config dropdown choices
- **Status payload:** Logo, black, and clear actions share `buildStatusPayload()` in `actions.js` to construct the 14-field status command
- **Reconnection:** One path only — `scheduleReconnect()` → retries `connectTCP()` or restarts discovery if address is unknown
