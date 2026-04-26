# API Reference

Current reference for the public MCP surface exposed by `codex-mcp-server`.

## Requirements

- Codex CLI `v0.75.0+`
- An authenticated Codex CLI (`codex login --api-key "..."`)
- For resumed-session `fullAuto` or `bypassApprovals`, use a Codex CLI build whose `codex exec resume --help` lists those flags

## Tool Matrix

| Tool | Purpose | Progress-capable | Spawns Codex CLI |
| --- | --- | --- | --- |
| `codex` | General Codex execution with sessions and execution controls | Yes | Yes |
| `review` | Repository review against working tree, base branch, or commit | Yes | Yes |
| `websearch` | Search-backed Codex run via `codex --search exec` | Yes | Yes |
| `help` | Return `codex --help` output | Yes | Yes |
| `listSessions` | List active in-memory sessions | No | No |
| `ping` | Echo/health check | No | No |

## `codex`

Execute Codex CLI in non-interactive mode.

| Parameter | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `prompt` | string | Yes | - | Main Codex task |
| `sessionId` | string | No | - | Caller-supplied session key, 1-256 chars, `[A-Za-z0-9_-]+` |
| `resetSession` | boolean | No | `false` | Clears stored server-side history before this request |
| `model` | string | No | `gpt-5.4` | Free-form Codex model string |
| `reasoningEffort` | enum | No | - | `none`, `minimal`, `low`, `medium`, `high`, `xhigh` |
| `sandbox` | enum | No | - | `read-only`, `workspace-write`, `danger-full-access` |
| `fullAuto` | boolean | No | `false` | Sandboxed automatic execution without approval prompts |
| `bypassApprovals` | boolean | No | `false` | Disables prompts and sandboxing entirely; use only in externally sandboxed environments |
| `workingDirectory` | string | No | - | Passed via `-C` for new executions |
| `callbackUri` | string | No | - | Overrides `CODEX_MCP_CALLBACK_URI` for this request |
| `timeoutMs` | integer | No | `CODEX_TOOL_TIMEOUT_MS` or `120000` | Per-request override for this tool only |

Important behavior:

- `bypassApprovals` is mutually exclusive with `sandbox`.
- `bypassApprovals` is mutually exclusive with `fullAuto`.
- On resumed sessions, `sandbox` and `workingDirectory` are not applied.
- On resumed sessions, this server still forwards `fullAuto` and `bypassApprovals` when requested. If your local Codex CLI does not support those resume flags, the CLI itself will reject the command.

Response behavior:

- The primary text result is returned in `content[0].text`.
- `content[0]._meta` includes `model`, plus `sessionId`, `callbackUri`, and `threadId` when available.
- `structuredContent` is only included when `STRUCTURED_CONTENT_ENABLED` is truthy.

Example:

```json
{
  "prompt": "Review this refactor for race conditions",
  "sessionId": "race-audit",
  "model": "gpt-5.4",
  "reasoningEffort": "high",
  "timeoutMs": 300000
}
```

## `review`

Run `codex review`.

| Parameter | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `prompt` | string | No | - | Extra review instructions |
| `uncommitted` | boolean | No | `false` | Review staged, unstaged, and untracked changes |
| `base` | string | No | - | Review against a branch or ref |
| `commit` | string | No | - | Review a single commit |
| `title` | string | No | - | Optional review title |
| `model` | string | No | `gpt-5.4` | Passed via `-c model="..."` |
| `workingDirectory` | string | No | - | Passed via global `-C` and spawn `cwd` |

Notes:

- `prompt` cannot be combined with `uncommitted: true`.
- Global `CODEX_TOOL_TIMEOUT_MS` still applies.
- Timed-out reviews now honor abort and unblock the serialized queue promptly.

## `websearch`

Run `codex --search exec`.

| Parameter | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `query` | string | Yes | - | Search request |
| `numResults` | integer | No | `10` | `1` through `50` |
| `searchDepth` | enum | No | `basic` | `basic` or `full` |

Notes:

- Global `CODEX_TOOL_TIMEOUT_MS` applies.
- Timed-out web searches honor abort and unblock the serialized queue promptly.

## `help`

Returns `codex --help`.

- No arguments
- Global `CODEX_TOOL_TIMEOUT_MS` applies
- Timed-out help calls honor abort and unblock the serialized queue promptly

## `listSessions`

Returns active in-memory session metadata for the current server process.

Example payload shape:

```json
[
  {
    "id": "refactor-thread",
    "createdAt": "2026-04-26T08:00:00.000Z",
    "lastAccessedAt": "2026-04-26T08:15:00.000Z",
    "turnCount": 3
  }
]
```

## `ping`

Echo/health check.

| Parameter | Type | Required | Default |
| --- | --- | --- | --- |
| `message` | string | No | `pong` |

## Sessions

- Sessions are server-process local and stored only in memory.
- A session is created on first `codex` call that supplies `sessionId`.
- The server stores recent turns plus the Codex conversation ID when it can extract one from CLI output.
- Sessions expire after 24 hours of inactivity.
- The store keeps at most 100 sessions.
- If the server restarts, sessions are lost.

## Environment Variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `CODEX_DEFAULT_MODEL` | Override the default model for `codex` and `review` | `gpt-5.4` |
| `CODEX_MCP_CALLBACK_URI` | Default callback URI for `codex` requests | unset |
| `CODEX_TOOL_TIMEOUT_MS` | Timeout for serialized tool calls | `120000` |
| `STRUCTURED_CONTENT_ENABLED` | Emit `structuredContent` alongside `_meta` | unset / false |
| `CODEX_MCP_DEBUG_STARTUP` | Emit a startup banner to stderr | unset / false |
| `CODEX_MCP_DEBUG_COMMANDS` | Emit command argv and stderr to stderr | unset / false |

## Current Constraints

- Calls are serialized through one queue to avoid stdio races.
- `timeoutMs` is only a `codex` tool parameter; other tools use the global timeout.
- `sandbox` and `workingDirectory` are not applied on resumed Codex sessions.
