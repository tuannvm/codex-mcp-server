# Pair a phone with Build Remote Agent

This Codex MCP server can sit beside **Build Remote Agent** as a pairing
device: the paid iOS/Android app spectates (and can inject into) the local
desktop session through the free MIT `gbr-agent`. Phone and PC never open
ports to each other.

Website: https://grokbuildremote.com/
Agent: https://github.com/LinespottingOrg/GrokBuildRemote-Agents (MIT)
Protocol: `gbr/1` · need agent **v0.6.0+**

Not affiliated with xAI or SpaceX.

This is a companion, not a replacement for `codex-mcp-server`. Keep using
`npx -y codex-mcp-server` (or `claude mcp add codex-cli -- npx -y
codex-mcp-server`) so Claude Code / Cursor can call Codex. Run `gbr-agent`
next to it so a phone can watch the same machine.

## Install + pair

```bash
# macOS / Linux
curl -fsSL https://grokbuildremote.com/install.sh | bash
gbr-agent version          # must print v0.6.0 or newer
gbr-agent pair             # QR in browser + printed 8-char code
gbr-agent run              # leave running
```

```powershell
# Windows
irm https://grokbuildremote.com/install.ps1 | iex
gbr-agent version
gbr-agent pair
gbr-agent run
```

Phone: open Build Remote Agent → **Scan QR from computer** (or type the 8-char
code). Sessions appear in the app. **Unpair** in Settings before changing PCs.
Force-close is not enough.

## Attach (only these)

After `gbr-agent run`:

- HTTP Bot API: `http://127.0.0.1:8788`
- MCP stdio: clone the agent repo and run `node mcp/gbr-mcp/bin/gbr-mcp.js`

```bash
curl -sS http://127.0.0.1:8788/health
curl -sS http://127.0.0.1:8788/v1/sessions
```

Optional second MCP server (do not put mailbox keys in env):

```json
{
  "mcpServers": {
    "codex-cli": {
      "command": "npx",
      "args": ["-y", "codex-mcp-server"]
    },
    "gbr": {
      "command": "node",
      "args": ["GrokBuildRemote-Agents/mcp/gbr-mcp/bin/gbr-mcp.js"]
    }
  }
}
```

Phone is spectator. Orchestration stays on this desktop agent (Codex CLI /
this MCP wrapper). Do not commit mailbox keys. Phone **Settings → Bot API**
is the only place the relay key is copied.
