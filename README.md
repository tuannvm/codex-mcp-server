# Codex MCP Server

MCP server wrapper for OpenAI Codex CLI that enables Claude Code to leverage Codex's AI capabilities directly.

## Prerequisites

- **OpenAI Codex CLI** must be pre-installed and configured
  - Install: `npm i -g @openai/codex` or `brew install codex`
  - Setup: Run `codex login` or set `OPENAI_API_KEY` environment variable
- **Claude Code** installed

## Installation

Add to Claude Code with a single command:

```bash
claude mcp add codex-cli -- npx -y codex-mcp-server
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