# Browser Use

Playwright-based browser automation. Launch a real Chromium browser, take screenshots, click, type, scroll, drag, and navigate — all via MCP tools.

## Architecture

```
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

Playwright is a **peer dependency** — install it separately. The server works fine without it; browser tools will return a helpful error if Playwright isn't available.

## Tools

### `browser_status` — Health Check

Works even without Playwright installed. Returns availability, active sessions, and any error.

```json
{ "sessionId": "my-session" }
```

### `browser_launch` — Launch Browser

Creates a new browser session. Supports multiple concurrent sessions with unique IDs.

```json
{
  "sessionId": "my-session",
  "url": "https://example.com",
  "headless": true,
  "viewportWidth": 1440,
  "viewportHeight": 900
}
```

### `browser_screenshot` — Take Screenshot

Returns base64 PNG image data along with the current page URL and title.

```json
{ "sessionId": "my-session" }
```

### `browser_click` — Click

Click at viewport-relative pixel coordinates.

```json
{ "sessionId": "my-session", "x": 100, "y": 200, "button": "left", "clickCount": 1 }
```

### `browser_type` — Type Text

Type literal text into the currently focused element. Click on an input field first.

```json
{ "sessionId": "my-session", "text": "hello world" }
```

### `browser_scroll` — Scroll

Scroll the page in a direction by a pixel amount.

```json
{ "sessionId": "my-session", "direction": "down", "amount": 300 }
```

### `browser_drag` — Drag

Drag from one coordinate to another (viewport-relative).

```json
{ "sessionId": "my-session", "fromX": 100, "fromY": 100, "toX": 300, "toY": 300 }
```

### `browser_key` — Key Press

Press a key or key combination. Supports Playwright key names. Modifier keys are auto-normalized: `Cmd` → `Meta`, `Ctrl` → `Control`, `Opt` → `Alt`, etc.

```json
{ "sessionId": "my-session", "key": "Control+a" }
{ "sessionId": "my-session", "key": "Cmd+s" }
```

### `browser_navigate` — Navigate

Go to a URL in the current page.

```json
{ "sessionId": "my-session", "url": "https://example.com" }
```

### `browser_close` — Close Session

Close a browser session and clean up resources.

```json
{ "sessionId": "my-session" }
```

## Troubleshooting

**"Playwright is not installed"**
Install it: `npm install playwright && npx playwright install chromium`

**"Session already exists"**
Use a different sessionId or close the existing session first with `browser_close`.

**"No active browser session"**
You must call `browser_launch` before using other browser tools.

**Screenshots not loading**
Check that the client supports `image` content type in MCP tool results. Claude Code supports this natively.
