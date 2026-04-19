# Computer Use

OS-level macOS computer control via Codex's accessibility binary. Control running apps through screenshots, accessibility trees, clicks, typing, and keyboard shortcuts.

## Architecture

```
Claude Code
  → codex-mcp-server
    → ComputerUseBridge (singleton, lazy init)
      → open-computer-use / SkyComputerUseClient (subprocess)
        → stdio JSON-RPC (newline-delimited)
          → macOS Accessibility APIs
```

The bridge spawns the binary once and maintains a persistent connection. Binary discovery happens on the first computer-use tool call — no impact on codex/review startup.

## Binary Setup

### Option 1: npm package (recommended)

```bash
npm install -g open-codex-computer-use-mcp
open-computer-use doctor
```

The `doctor` command verifies the binary runs and can communicate.

### Option 2: Codex.app bundled binary

If Codex.app is installed at `/Applications/Codex.app`, the `SkyComputerUseClient` binary is detected automatically.

If it fails to launch (hardened runtime restriction), re-sign it:

```bash
sudo codesign --force --deep --sign - \
  "/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
```

### Custom binary path

Set `CODEX_COMPUTER_USE_BINARY` to any binary that speaks the same protocol:

```json
{
  "mcpServers": {
    "codex-cli": {
      "command": "npx",
      "args": ["-y", "codex-mcp-server"],
      "env": {
        "CODEX_COMPUTER_USE_BINARY": "/usr/local/bin/open-computer-use"
      }
    }
  }
}
```

## Discovery Priority

1. `CODEX_COMPUTER_USE_BINARY` env var (explicit override)
2. `open-computer-use` in PATH (npm global install)
3. Codex.app bundled `SkyComputerUseClient`

## Protocol

The binary speaks bare **newline-delimited JSON-RPC** (not Content-Length framed). The bridge handles:

1. MCP `initialize` handshake (`protocolVersion: "2024-11-05"`)
2. `notifications/initialized` confirmation
3. `tools/call` requests with request/response correlation via incrementing `id`

**Timeouts**: 30s default, 60s for `get_app_state` (screenshots take longer).

## Tools

### `cu_status` — Health Check

Works on any platform (no binary needed). Returns binary path, discovery type, and connection status.

```json
{ "connected": true, "binary": { "path": "/usr/local/bin/open-computer-use", "type": "npm-package" }, "error": null }
```

### `cu_list_apps` — List Apps

Returns running and recently used macOS apps. Call this first to discover what's available.

```json
{ "app": "Finder" }
```

### `cu_get_app_state` — Screenshot + Accessibility Tree

Returns a screenshot (as base64 image data) and the accessibility tree with element indices. Must be called once per turn before interacting with an app.

```json
{ "app": "Safari" }
```

Response includes both `text` (accessibility tree) and `image` content (screenshot).

### `cu_click` — Click Element

Click by accessibility index (preferred) or pixel coordinates.

```json
{ "app": "Safari", "element_index": "42" }
{ "app": "Finder", "x": 100, "y": 200, "mouse_button": "right", "click_count": 2 }
```

### `cu_type_text` — Type Text

Type literal text into a focused input field.

```json
{ "app": "Terminal", "text": "npm run build" }
```

### `cu_press_key` — Key Press

Press a key or key-combination using xdotool-style syntax.

```json
{ "app": "VSCode", "key": "cmd+s" }
{ "app": "Finder", "key": "cmd+shift+n" }
{ "app": "Terminal", "key": "Return" }
```

### `cu_scroll` — Scroll Element

Scroll in a direction by a number of pages.

```json
{ "app": "Safari", "element_index": "5", "direction": "down", "pages": 3 }
```

### `cu_drag` — Drag

Drag from one pixel coordinate to another.

```json
{ "app": "Finder", "from_x": 100, "from_y": 100, "to_x": 300, "to_y": 300 }
```

### `cu_set_value` — Set Value

Set the value of a slider, text field, or other settable accessibility element.

```json
{ "app": "System Preferences", "element_index": "12", "value": "80" }
```

### `cu_perform_secondary_action` — Secondary Action

Invoke a secondary accessibility action (toggle, expand, pick, etc.).

```json
{ "app": "Finder", "element_index": "8", "action": "toggle" }
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CODEX_COMPUTER_USE_BINARY` | Path to binary (overrides auto-discovery) |
| `NODE_DEBUG` | Include `computer-use` to forward binary stderr |

## Troubleshooting

**"Computer Use tools are only available on macOS"**
These tools require macOS accessibility APIs. They won't work on Linux or Windows.

**"Computer Use binary not found"**
Install via npm (`npm install -g open-codex-computer-use-mcp`), install Codex.app, or set `CODEX_COMPUTER_USE_BINARY`.

**"Binary spawn failed" or "initialize failed"**
The binary likely needs re-signing. Run `/codex-setup` in Claude Code, or manually:
```bash
sudo codesign --force --deep --sign - <binary_path>
```

**"Request timed out"**
`get_app_state` has a 60s timeout; other tools have 30s. The app may be unresponsive.

**No screenshot in `get_app_state` response**
Some apps don't expose their window content to accessibility. This is an OS limitation.
