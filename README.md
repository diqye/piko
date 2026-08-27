# Piko

A capsule for pi code agent — a floating, always-on-top window that shows agent status (idle / thinking / working) at a glance. Compatible with Claude Code.



https://github.com/user-attachments/assets/dd214a4e-adda-42bf-917f-47060304ea77




## Features

- **Floating capsule**: a tiny window that stays on top, showing what your agent is doing right now
- **Multi-session**: tracks multiple agent sessions, displays the most recent active one
- **Tray menu**: toggle capsule visibility, clear sessions, quit
- **Minimal**: built on Electrobun + system WebKit, no Chromium bundled

## Size & Footprint

Measured on macOS arm64 (canary build):

- **Installer**: `piko-canary.dmg` 19M / `piko-canary.app.tar.zst` 18M
- **Runtime memory**: launcher 1.4 MB + bun main process 198 MB (≈ 199 MB total, includes WebKit)

## Installation

[**Download
 piko-canary.dmg**](https://github.com/diqye/piko/releases) —
 from the latest release assets.

> ⚠️ The canary DMG is **unsigned**. macOS Gatekeeper will block it on first open. You can clear the quarantine attribute with `xattr` to bypass it.

After downloading the artifact, run:

```bash
# Clear quarantine on the DMG before mounting
xattr -d com.apple.quarantine ~/Downloads/piko-canary.dmg

# Then mount the DMG, drag piko.app into /Applications, and clear quarantine on the app too:
xattr -dr com.apple.quarantine /Applications/piko.app
```


## Usage

### 1. Launch piko

Start piko, it runs a Unix domain socket server at `~/piko/piko.sock`.

### 2. Integrate with pi code agent

Click **Tray menu → Copy integration prompt**, then paste it into a pi code agent session. The agent will create an extension at `~/.pi/agent/extensions/piko.ts` that automatically reports status:

- **thinking** — when the agent is reasoning
- **working** — when the agent is outputting text or calling tools
- **idle** — when the agent finishes responding

### 3. Tray menu

- **Show capsule** — toggle capsule visibility (checkmark = visible)
- **Clear sessions** — remove all sessions, capsule returns to idle
- **Copy integration prompt** — copy the prompt to clipboard
- **About piko** — about window

## Q/A

### How to clean up zombie sessions?

If an agent crashes without sending an `idle` status, its session stays in the queue (zombie session). Two ways to clean up:

1. **Tray menu** → **Clear sessions**
2. **Restart piko**: all sessions are in-memory, restarting clears everything

### How to test?

```bash
./test/e2e.sh
```

Simulates thinking → working → multi-session → idle dequeue flow.
