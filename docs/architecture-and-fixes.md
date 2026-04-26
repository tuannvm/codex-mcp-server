# codex-mcp-server: Current Architecture and Hardening Notes

Current-state reference for the server architecture and the lifecycle fixes
landed so far.

## Source Layout

```text
src/
├── index.ts
├── server.ts
├── runtime-config.ts
├── types.ts
├── errors.ts
├── tools/
│   ├── definitions.ts
│   └── handlers.ts
├── utils/
│   └── command.ts
└── session/
    └── storage.ts
```

## Core Execution Model

1. The MCP stdio transport receives `tools/call`.
2. `server.ts` serializes every call through `callQueue`.
3. A per-request `AbortController` is created.
4. `withTimeout()` races the tool handler against the configured timeout.
5. On timeout, the controller aborts and the queue slot remains blocked until
   the underlying operation actually settles.

This serialization is intentional. It avoids the original stdio race where two
concurrent child processes could corrupt the JSON-RPC stream.

## Command Execution Model

`utils/command.ts` is the shared spawn path for command-backed tools.

Current behavior:

- closes child stdin immediately with `child.stdin?.end()`
- creates a detached process group when abort support is in use
- sends `SIGTERM`, then `SIGKILL` after a short grace period
- buffers stdout and stderr up to 10MB
- treats `stdout` or `stderr` output as a usable command result even if the exit
  code is non-zero, because Codex often writes primary output to stderr
- keeps command argv and stderr logging disabled by default

## Current Tool Coverage

Command-backed tools:

- `codex`
- `review`
- `websearch`
- `help`

Non-command-backed tools:

- `ping`
- `listSessions`

All command-backed tools now honor the shared abort path.

## Hardening Fixes Already Landed

### Concurrent-call serialization

`callQueue` ensures only one `tools/call` handler runs at a time.

### Queue does not release before child exit

The queue slot stays blocked until the underlying operation settles, including
timed-out calls.

### Non-interactive stdin handling

Spawned Codex children get EOF on stdin immediately so they do not hang waiting
for additional input.

### Timeout recovery

- global timeout via `CODEX_TOOL_TIMEOUT_MS`
- per-call timeout override via `timeoutMs` on the `codex` tool
- shared abort path now applies to `codex`, `review`, `websearch`, and `help`

### Startup and command logging cleanup

- startup banner is gated by `CODEX_MCP_DEBUG_STARTUP`
- command argv/stderr logging is gated by `CODEX_MCP_DEBUG_COMMANDS`

### Default model drift fix

Default model is `gpt-5.4`, with `CODEX_DEFAULT_MODEL` as the override.

### `bypassApprovals` contract completion

- exposed in the MCP tool definition
- forwarded on new and resumed Codex executions
- rejected when combined with `sandbox`
- rejected when combined with `fullAuto`

## Session Model

- sessions are in-memory only
- caller provides `sessionId`
- server stores recent turns plus the Codex conversation ID when available
- native Codex resume is preferred
- fallback context reconstruction uses recent turns when native resume is not
  available

## Current Environment Variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `CODEX_DEFAULT_MODEL` | Override the default model for `codex` and `review` | `gpt-5.4` |
| `CODEX_MCP_CALLBACK_URI` | Default callback URI for `codex` requests | unset |
| `CODEX_TOOL_TIMEOUT_MS` | Timeout for serialized tool calls | `120000` |
| `STRUCTURED_CONTENT_ENABLED` | Emit `structuredContent` | unset / false |
| `CODEX_MCP_DEBUG_STARTUP` | Emit startup banner | unset / false |
| `CODEX_MCP_DEBUG_COMMANDS` | Emit command argv/stderr | unset / false |

## Intentional Constraints

- The queue still serializes all tool calls, not only Codex-heavy ones.
- `timeoutMs` is only a `codex` tool argument.
- `sandbox` and `workingDirectory` are not applied on resumed sessions.
- Session state is not persisted across server restarts.

## Verification Gate

Use the current repo state, not historical green claims:

```bash
npm run build
npm test -- --runInBand
```
