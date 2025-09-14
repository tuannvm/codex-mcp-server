# Quickstart

## 1) Install prerequisites

```bash
npm i -g @openai/codex   # or: brew install codex
codex login               # or export OPENAI_API_KEY=...
```

## 2) Add the server

=== "Claude Code"
```bash
claude mcp add codex-cli -- npx -y @comfucios/codex-mcp-server
```

=== "Claude Desktop (macOS)"
```json
{
  "mcpServers": {
    "codex-cli": {
      "command": "npx",
      "args": ["-y", "@comfucios/codex-mcp-server"]
    }
  }
}
```

## 3) Test connection

Use the **ping** tool or ask the **codex** tool a simple prompt.
