# Codex MCP Server

MCP server wrapper for OpenAI Codex CLI that enables Claude Code to leverage Codex's AI capabilities directly.

## Prerequisites

- **OpenAI Codex CLI** must be pre-installed and configured
  - Install: `npm i -g @openai/codex` or `brew install codex`
  - Setup: Run `codex login` or set `OPENAI_API_KEY` environment variable
- **Claude Code** installed

## Installation

### One-Click Installation

#### VS Code
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Codex_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=codex-cli&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22codex-mcp-server%22%5D%7D)

#### VS Code Insiders
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Codex_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=codex-cli&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22codex-mcp-server%22%5D%7D)

#### Cursor
[![Install in Cursor](https://img.shields.io/badge/Cursor-Install_Codex_MCP_Server-00D8FF?style=flat-square&logo=cursor&logoColor=white)](https://cursor.com/en/install-mcp?name=codex&config=eyJ0eXBlIjoic3RkaW8iLCJjb21tYW5kIjoibnB4IC15IGNvZGV4LW1jcC1zZXJ2ZXIiLCJlbnYiOnt9fQ%3D%3D)

### Manual Installation

#### Claude Code
```bash
claude mcp add codex-cli -- npx -y codex-mcp-server
```

#### Claude Desktop
Add to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codex-cli": {
      "command": "npx",
      "args": ["-y", "codex-mcp-server"]
    }
  }
}
```

## Usage in Claude Code

Once installed, Claude Code can use these tools:

### `codex` - AI Coding Assistant
Ask Codex to analyze code, generate solutions, or provide coding assistance.

**Usage:**
```
Use the codex tool to explain this function:
[paste your code here]
```

**Parameters:**
- `prompt` (required): Your coding question or request

### `ping` - Connection Test
Test if the MCP server is working properly.

### `help` - Codex CLI Help
Get information about Codex CLI capabilities and commands.

## Example Workflows

**Code Analysis:**
```
Please use the codex tool to review this TypeScript function and suggest improvements
```

**Bug Fixing:**
```
Use codex to help debug this error: [error message]
```

**Code Generation:**
```
Ask codex to create a React component that handles file uploads
```

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Start built server
npm start
```

## License

ISC
