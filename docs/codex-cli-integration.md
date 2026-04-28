# Codex CLI Integration

Current integration notes for `codex-mcp-server`.

## Supported Baseline

- Recommended minimum: Codex CLI `v0.75.0+`
- Authentication: `codex login --api-key "..."`
- This server expects modern `codex exec resume`, `codex review`, sandbox, and
  working-directory support

If you rely on resumed-session `fullAuto` or `bypassApprovals`, verify your
local CLI supports them with:

```bash
codex exec resume --help
```

## Command Shapes Used by the Server

New execution:

```text
codex exec --model <model> [flags...] --skip-git-repo-check <prompt>
```

Resume execution:

```text
codex exec --skip-git-repo-check -c model="<model>" [-c model_reasoning_effort="..."] [flags...] resume <conversation-id> <prompt>
```

Review:

```text
codex [-C <dir>] -c model="<model>" review [review flags...]
```

Web search:

```text
codex --search exec --skip-git-repo-check <search prompt>
```

## Flags the Server Exposes

### `codex`

- `--model`
- `-c model_reasoning_effort="..."`
- `--sandbox <mode>` for new executions only
- `--full-auto`
- `--dangerously-bypass-approvals-and-sandbox`
- `-C <dir>` for new executions only
- `--skip-git-repo-check`

### `review`

- `-c model="..."`
- `-C <dir>`
- `--uncommitted`
- `--base <ref>`
- `--commit <sha>`
- `--title <text>`

### `websearch`

- `--search`
- `exec`
- `--skip-git-repo-check`

## Resume Notes

- `sandbox` is not applied on resumed sessions.
- `workingDirectory` is not applied on resumed sessions.
- This server now forwards `fullAuto` and `bypassApprovals` on resume when the
  caller asks for them.
- The server still uses `-c model="..."` for resume mode for consistency,
  even though newer Codex CLI builds also expose `--model`.

## Timeout and Abort

- All `tools/call` requests are serialized.
- Global timeout: `CODEX_TOOL_TIMEOUT_MS`, default `120000`
- `codex` also supports per-request `timeoutMs`
- `codex`, `review`, `websearch`, and `help` now all honor the shared abort
  path when they time out

## Environment Variables Used by This Server

- `CODEX_DEFAULT_MODEL`
- `CODEX_MCP_CALLBACK_URI`
- `CODEX_TOOL_TIMEOUT_MS`
- `STRUCTURED_CONTENT_ENABLED`
- `CODEX_MCP_DEBUG_STARTUP`
- `CODEX_MCP_DEBUG_COMMANDS`

## Current Default Model and Reasoning Values

- Default model: `gpt-5.4`
- Documented reasoning values: `none`, `minimal`, `low`, `medium`, `high`,
  `xhigh`

## Current Gaps

- `timeoutMs` is only exposed on the `codex` tool, not on `review`, `help`, or
  `websearch`
- Sessions are process-local and in-memory only
