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
2. Tag **with** the `v` prefix (e.g., `git tag -a v2.1.2 -m "v2.1.2"`). Bitfocus maintainers explicitly requested this when releasing 2.1.1 ("in the future please include the 'v' in your version tags") — they had to fix the unprefixed 2.1.1 tag themselves. The repo's 2.0.x–2.1.1 tags are unprefixed; that was wrong. Do not retag old releases.
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
- `presets.js` — UI preset button definitions. References PNG icons via `require('./presets-images')`.
- `presets-images.js` — Base64-encoded PNG button icons, one per const. Split out so `presets.js` stays diff-friendly; any preset-layout change would otherwise be buried under image bytes.
- `upgrades.js` — Array of upgrade scripts, passed as the second arg to `runEntrypoint()`. Runs on saved button configs when users upgrade the module. Currently contains one script (`v210_removeDummyOptions`) that strips the orphaned `id_logo`/`id_black`/… dummy options left behind when 15 actions dropped their unused `{ id: '0', label: 'Not used' }` dropdowns.

**Connection lifecycle:**
1. `init()` → try cached server immediately if address/port are saved from a previous session
2. `startDiscovery()` runs in parallel — Bonjour mDNS discovery for `ezwremote._tcp` services
3. `connectTCP()` → TCP socket connection to server
4. Pairing handshake via JSON `connect` command with UUID
5. 30s keepalive heartbeat keeps connection alive; detects dead sockets via TCP send failure
6. `scheduleReconnect()` — single reconnection path on disconnect. Two phases, both keep trying forever:
   - **Phase 1 (first 3 minutes):** aggressive backoff, 1s → 1.5s → 2.3s → 3.4s → 5s cap. Tech is probably watching; hammer fast.
   - **Phase 2 (after 3 minutes of continuous failure):** drops to 30s retries. EW is likely offline or the network is wrong; keep trying but stop burning CPU/logs. Bonjour rediscovery runs on its own path and will short-circuit this if EW reappears on a different IP.
   - The `connectezw` action and any successful pair reset back to Phase 1 by clearing `retryStartedAt`.

**Critical design intent — cached connect vs Bonjour:**
The module connects to the last known server/address/port *immediately* on startup, without waiting for Bonjour. Bonjour runs in parallel for discovering new servers and detecting address changes, but it is NOT a gate for connecting. This is intentional — mDNS can be slow or unreliable, and the common case (same server, same address) should connect in under a second. The `!this.connected` guard in the discovery callback prevents Bonjour from stomping on an already-active connection.

**Key design decisions:**
- TCP data is buffered in `_receiveBuffer` and only parsed on complete `\r\n`-delimited lines (handles stream fragmentation)
- Bonjour instance stored on `this.bonjour` — single persistent instance, do NOT churn/recreate it. The guard `if (this.bonjour) return` in `startDiscovery()` is intentional.
- There is NO push API for config fields in `@companion-module/base` 1.x — `setConfigFields()` does not exist and calling it crashes the module process (this caused the v2.1.0/2.1.1 restart loop). The dropdown refreshes because Companion calls `getConfigFields()` each time the user opens the config panel; `this.ezw[]` just needs to be current at that moment.
- All socket writes go through `socketSend()` which handles encoding and error logging
- `sendCommand()` validates pairing state and delegates to `socketSend()`; triggers `scheduleReconnect()` if unpaired
- Cleanup is centralized: `destroySocket()`, `stopDiscovery()`, `clearRetry()`, `clearKeepalive()`. The Reconnect (`connectezw`) action calls all four plus `startDiscovery()` — there is NO separate idle timer; earlier code mistakenly called `this.clearIdleTimer()` here and crashed the button.
- EW is silent when idle — this is normal, NOT a failure. Do not treat silence as a dead connection. The keepalive heartbeat handles socket liveness detection.

**Protocol:** All communication is JSON over TCP (`\r\n` delimited). Commands include an `action` field and `requestrev` sequence number. Actions enforce a `paired` check before sending. No formal protocol spec exists — behavior was reverse-engineered from the codebase and confirmed against EW KB articles. `KNOWN_ACTIONS` set defines fully-processed action types; unknown actions still get heartbeat responses for forward compatibility.

## Key Patterns

- **State on instance:** `this.paired`, `this.connected`, `this.socket`, `this.ezw[]` (discovered servers), `this.EZWLogo/Black/Clear/LivePreview`
- **Factory exports:** Each module file exports a function (e.g., `getPresets(instance)`, `actions()`) — not classes
- **Bonjour discovery:** Servers found via mDNS are stored in `this.ezw[]` and presented as config dropdown choices when the user opens the config panel (Companion calls `getConfigFields()` on demand). Discovery prefers `service.referer.address` (the source IP of the mDNS response) over `service.addresses[0]`, which can be an unreachable virtual-adapter IP (WSL/Hyper-V NAT).
- **Cached server on startup:** `this.ezw` is seeded with the saved server name in `init()` so the dropdown has it before Bonjour discovers anything
- **Status payload:** Logo, black, and clear actions share `buildStatusPayload()` in `actions.js` to construct the 14-field status command
- **Reconnection:** One path only — `scheduleReconnect()` → retries `connectTCP()` or restarts discovery if address is unknown
- **Config fields:** Use `default:` not `value:` for textinput initial values — Companion calls `.trim()` on values and will throw on undefined. `static-text` fields do use `value:` (they're display-only).
- **Upgrade scripts:** Wired via `runEntrypoint(EasyWorshipInstance, UpgradeScripts)` at the bottom of `index.js`. Each script receives `(context, props)` and returns `{ updatedConfig, updatedActions, updatedFeedbacks }` — arrays of mutated entries that Companion persists back into the user's saved button configs.
- **Variables for diagnostics:** `ReconnectCount` tracks how many times the paired connection has dropped this session. Useful on a debug button (`$(softouch-easyworship:ReconnectCount)`) when diagnosing a flaky network. Incremented in the TCP `error` and `close` handlers, but only when `paired` was true — pre-pair TCP failures are handled by the retry loop and shouldn't inflate the number.
- **Send-failure signalling:** `socketSend()` returns a boolean — `false` if the socket was already gone when we tried to send. `sendCommand()` propagates that so the overlay toggles (logo/black/clear) revert their optimistic state updates when the write doesn't actually land. Async send failures additionally schedule a reconnect.

## Known Constraints

- `@companion-module/tools` declared as ^2.6.1, resolves to 2.7.x. Runs on Node 22 (package.json `engines.node: ">=22"`, manifest `runtime.type: "node22"`). Tools 3.0 is a major bump requiring evaluation.
- `@companion-module/base` declared as ^1.12.0 to satisfy tools' peer dep; resolves to 1.14.x.
- `serialize-javascript` vulnerability (Dependabot alert #13) is in the build-time dependency chain only — does not ship in the module `.tgz`.
- `companion-generate-manifest` produces platform-specific path separators via `path.join()` — hand-verify `runtime.entrypoint` uses forward slashes if ever regenerating on Windows.

## Bitfocus Submission Gotchas (learned the hard way)

- **`maintainers` array is not backfilled from `package.json` author.** The manifest ships verbatim. Must be populated in `companion/manifest.json` directly. v2.1.0 was rejected partly for this.
- **`apiVersion: "0.0.0"` in the source manifest is expected** — build overrides to the real base version.
- **Reviews can take 1.5+ weeks.** Front-load every review bullet before submitting; a second round is another long wait.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **companion-module-softouch-easyworship** (129 symbols, 299 relationships, 19 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/companion-module-softouch-easyworship/context` | Codebase overview, check index freshness |
| `gitnexus://repo/companion-module-softouch-easyworship/clusters` | All functional areas |
| `gitnexus://repo/companion-module-softouch-easyworship/processes` | All execution flows |
| `gitnexus://repo/companion-module-softouch-easyworship/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
