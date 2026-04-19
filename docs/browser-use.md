# Browser Use

Playwright-based browser automation. Launch a real Chromium browser, take screenshots, click, type, scroll, drag, and navigate — all via a single MCP tool with an `action` parameter.

## Architecture

```text
Claude Code
  → codex-mcp-server
    → BrowserUseBridge (singleton, lazy init)
      → Playwright (peer dependency)
        → Chromium instances
```

The bridge manages multiple concurrent browser sessions. Playwright is only imported on first use — no impact on codex/review startup when browser tools aren't used.

## Setup

```bash
npm install playwright
npx playwright install chromium
```

Playwright is a **peer dependency** — install it separately. The server works fine without it; the browser tool will return a helpful error if Playwright isn't available.

## Tool: `browser`

A single tool for all browser operations. Every call requires an `action` parameter.

### Session Lifecycle

| Action | Example | Description |
|--------|---------|-------------|
| `open` | `{ "action": "open", "sessionId": "s1", "url": "https://example.com" }` | Launch a browser session. Optional: `url`, `headless` (default true), `viewportWidth` (default 1440), `viewportHeight` (default 900) |
| `status` | `{ "action": "status" }` | Check if Playwright is available and list active sessions |
| `close` | `{ "action": "close", "sessionId": "s1" }` | Close a session and clean up resources |

### Navigation & Capture

| Action | Example | Description |
|--------|---------|-------------|
| `navigate` | `{ "action": "navigate", "sessionId": "s1", "url": "https://example.com/page2" }` | Navigate to a URL |
| `screenshot` | `{ "action": "screenshot", "sessionId": "s1" }` | Take a screenshot. Returns base64 PNG image data + page URL + title |

### Input Actions

| Action | Example | Description |
|--------|---------|-------------|
| `click` | `{ "action": "click", "sessionId": "s1", "x": 100, "y": 200 }` | Click at viewport coordinates. Optional: `button` (left/right/middle), `clickCount` |
| `type` | `{ "action": "type", "sessionId": "s1", "text": "hello world" }` | Type text into the focused element |
| `key` | `{ "action": "key", "sessionId": "s1", "key": "Control+a" }` | Press a key or combo. Modifier keys auto-normalized (`Cmd`→`Meta`, `Ctrl`→`Control`) |
| `scroll` | `{ "action": "scroll", "sessionId": "s1", "direction": "down", "amount": 300 }` | Scroll page: `up`/`down`/`left`/`right` by pixel amount |
| `drag` | `{ "action": "drag", "sessionId": "s1", "fromX": 0, "fromY": 0, "toX": 100, "toY": 100 }` | Drag from one coordinate to another (viewport-relative) |

## Troubleshooting

**"Playwright is not installed"**
Install it: `npm install playwright && npx playwright install chromium`

**"Session already exists"**
Use a different sessionId or close the existing session first.

**"No active browser session"**
You must call `{ "action": "open" }` before any other action.

**Screenshots not loading**
Check that the client supports `image` content type in MCP tool results. Claude Code supports this natively.
