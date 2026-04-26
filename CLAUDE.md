# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Type

This is an **MCP (Model Context Protocol) server** that wraps OpenAI's Codex CLI, exposing it as tools to Claude Code and other MCP clients.

## Development Commands

```bash
# Build TypeScript to dist/
npm run build

# Development mode (runs src/index.ts directly with tsx)
npm run dev

# Run tests
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report

# Run a single test file
npx jest src/__tests__/context-building.test.ts

# Linting and formatting
npm run lint          # ESLint
npm run lint:fix      # Auto-fix lint issues
npm run format        # Prettier
make lint             # Run both lint and format
```

## Architecture

### Core Flow

```
MCP Client (Claude Code)
    → StdioTransport
    → CodexMcpServer (server.ts)
    → ToolHandlers (handlers.ts)
    → executeCommand (command.ts)
    → Codex CLI
```

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point, creates and starts `CodexMcpServer` |
| `src/server.ts` | MCP server setup, handles `list_tools` and `call_tool` requests |
| `src/tools/definitions.ts` | MCP tool schemas (input/output) and annotations |
| `src/tools/handlers.ts` | Tool execution logic (codex, review, websearch, etc.) |
| `src/types.ts` | Type definitions, Zod schemas, tool constants |
| `src/session/storage.ts` | In-memory session storage for conversation context |
| `src/utils/command.ts` | Command spawning with streaming support and Windows compatibility |
| `src/errors.ts` | Custom error classes (ValidationError, ToolExecutionError) |

### MCP Tools

- **codex**: Execute Codex CLI with session support, model selection, reasoning effort, sandbox mode, full-auto, and working directory options
- **review**: Code review for uncommitted changes, branches, or commits
- **websearch**: Web search using Codex CLI with `--search` flag
- **listSessions**: View active conversation sessions
- **ping**: Test server connection
- **help**: Get Codex CLI help

### Session Management

Sessions enable multi-turn conversations with Codex:

1. **First request with sessionId**: Creates session, runs normal `codex exec`, extracts conversation/session ID from stderr
2. **Subsequent requests with same sessionId**: Uses `codex exec resume <conversation-id>` (native Codex resume)
3. **Fallback**: If no conversation ID exists, manually builds enhanced prompt from conversation history

**Important**: When resuming sessions, `sandbox` and `workingDirectory` are not applied. This server does forward `fullAuto` and `bypassApprovals` on resume, but those flags still depend on the installed Codex CLI supporting them.

### Streaming Progress

Tools support streaming progress via MCP `notifications/progress`:

```typescript
// In server.ts - progress context is created from request._meta?.progressToken
const context = createProgressContext();

// In handlers - send progress updates
await context.sendProgress('Processing...', 1, 10);
```

### Structured Output (Codex 0.87+)

When Codex emits `threadId`, it's returned in:
- `content[0]._meta` - For Claude Code compatibility
- `structuredContent` - For other MCP clients (enabled via `STRUCTURED_CONTENT_ENABLED` env var)

## Important Implementation Details

### Command Execution

- **Stderr handling**: Codex CLI writes most output to stderr, not stdout. Both are captured and merged.
- **Exit codes**: Commands that produce output are treated as success even if exit code is non-zero.
- **Buffer truncation**: Output truncated at 10MB to prevent memory exhaustion.
- **Windows compatibility**: Arguments are escaped for cmd.exe (`%` → `%%`, `"` → `""`).

### Codex Command Structure

Commands are built differently based on mode:

**Exec mode** (new conversations):
```
codex exec --model X --sandbox Y [-c config=value] --skip-git-repo-check "prompt"
```

**Resume mode** (existing conversations):
```
codex exec --skip-git-repo-check -c model="X" -c model_reasoning_effort="Y" [--full-auto] [--dangerously-bypass-approvals-and-sandbox] resume <conversation-id> "prompt"
```

Note: Config flags (`-c`) must come BEFORE the subcommand (`exec` or `resume`).

### Environment Variables

- `CODEX_DEFAULT_MODEL`: Default model for codex/review tools (default: `gpt-5.4`)
- `CODEX_MCP_CALLBACK_URI`: Static MCP callback URI passed to Codex (override via tool arg)
- `STRUCTURED_CONTENT_ENABLED`: Enable `structuredContent` in responses (default: false)
- `CODEX_MCP_DEBUG_STARTUP`: Emit startup banner for debugging (default: false)
- `CODEX_MCP_DEBUG_COMMANDS`: Emit command argv/stderr for debugging (default: false)

## TypeScript Configuration

- Target: ES2022, Module: ESNext
- Output: `dist/` directory
- Strict mode enabled
- All imports must include `.js` extension (ESM)
