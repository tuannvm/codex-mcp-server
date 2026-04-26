# Claude Code Lifecycle Investigation

Date: 2026-04-25

This document captures the end-to-end investigation of `codex-mcp-server`
behavior under Claude Code after the following fixes:

- `ac66ca1` `fix: serialize concurrent tools/call requests to prevent stdio race`
- `358c106` `feat: add per-call timeout to prevent queue starvation on hung API calls`
- `a1cd967` `fix: block queue until timed out codex child exits`
- follow-up runtime cleanup on 2026-04-25:
  - startup banner moved behind `CODEX_MCP_DEBUG_STARTUP`
  - server version now resolves from `package.json`
- follow-up timeout override on 2026-04-25:
  - `timeoutMs` added to the `codex` tool schema and MCP definition
  - per-call timeout now overrides `CODEX_TOOL_TIMEOUT_MS`
- follow-up lifecycle hardening on 2026-04-26:
  - `review`, `websearch`, and `help` now honor the shared abort path
  - command argv/stderr logging is now gated behind `CODEX_MCP_DEBUG_COMMANDS`
  - `bypassApprovals` is exposed and validated end-to-end

## Executive Summary

The current build does **not** reproduce the original "first call works, second
call hangs" failure under Claude Code.

What is fixed:

- Concurrent `tools/call` requests are serialized.
- A timed-out Codex child is aborted and the queue remains blocked until the
  child actually exits.
- Claude can make a second `mcp__codex__codex` call after a timeout in the same
  session.

What is not a server bug:

- Claude Code tears down stdio MCP servers at the end of `claude -p` sessions.
- Resuming a Claude conversation is path-scoped by Claude; the same session ID
  may fail outside the original local path.

## Scenario Matrix

| Scenario | Command shape | Result | Notes |
| --- | --- | --- | --- |
| Direct stdio lifecycle tests | `npm test -- --runInBand src/__tests__/mcp-lifecycle.test.ts --runTestsByPath` | Pass | Covers sequential calls, concurrent serialization, codex timeout recovery, and review timeout recovery |
| Claude print, single live Codex call | `claude -p --allowedTools mcp__codex__codex --tools "" ...` | Pass in 20s | Returned `LIVE_OK` |
| Claude print, two sequential live Codex calls | Same as above, but force two tool calls | Pass in 34s | Returned `FIRST_OK` then `SECOND_OK` |
| Claude print, resumed session, single live Codex call | `claude -p --resume <session-id> ...` from original local path | Pass in 30s | Returned `RESUMED_LIVE_OK` |
| Claude interactive resume | `claude --resume <session-id>` | Pass | Session opened normally and could invoke Codex |
| Claude print, strict stub, two fast calls | Temp MCP config with stub `codex` binary | Pass in 11s | Returned `stub stdout` twice |
| Claude print, strict stub, timeout then recovery | Temp MCP config with `CODEX_TOOL_TIMEOUT_MS=100` | Pass in 11s | First call timed out, second call still returned `stub stdout` |
| Claude print, strict stub, per-call timeout override | Temp MCP config with `CODEX_TOOL_TIMEOUT_MS=9000` and request `timeoutMs=100` | Pass in 15s | First call timed out at 100ms, second call still returned `stub stdout` |

## Key Evidence

### 1. Claude does not lose the second live call anymore

In the two-call live probe, Claude debug showed two distinct successful tool
dispatches:

- first `mcp__codex__codex` call started and ended successfully
- second `mcp__codex__codex` call started and ended successfully

After that, Claude sent `SIGINT` and closed the stdio connection cleanly. The
server did not crash between the two calls.

### 2. Timeout recovery now works under Claude itself

Using a strict temporary MCP config and a stub `codex` executable that:

- sleeps for 5 seconds for `slow-timeout`
- fails with `Not connected` on overlap
- returns quickly otherwise

Claude produced:

```text
Error in tool "codex": Tool call timed out after 100ms
stub stdout
```

That is the critical regression check. Before `a1cd967`, the timeout response
could be returned before the killed child had actually released its resources,
so the next queued call could still fail or wedge.

### 3. Claude still tears the server down after the session

Successful Claude debug logs consistently show this pattern after the final
response:

- Claude sends `SIGINT` to the MCP server process
- the `codex` stdio connection closes cleanly
- Claude records `MCP server process exited cleanly`

That supports the earlier lifecycle finding: Claude owns MCP server lifetime for
these print sessions.

## Root Cause Breakdown

### Bug 1: Concurrent request race

Cause:

- the `CallToolRequestSchema` handler allowed multiple `handler.execute()`
  calls to run at once
- concurrent child processes raced on the same Codex stdio path

Fix:

- serialize `tools/call` execution through `callQueue`

Status:

- fixed by `ac66ca1`

### Bug 2: Timeout released the queue too early

Cause:

- the server returned a timeout error to Claude
- but the underlying `handler.execute()` was still unwinding
- the next queued request could start before the timed-out child had fully
  exited

Fix:

- propagate an `AbortSignal`
- terminate the Codex child on timeout
- keep the queue blocked until the aborted operation actually settles

Status:

- fully fixed by `a1cd967`

### Non-bug: Claude session teardown

Observed behavior:

- at the end of successful `claude -p` runs, Claude sends `SIGINT`
- the MCP stdio connection closes cleanly

Interpretation:

- this is expected client lifecycle behavior
- it is not evidence that `codex-mcp-server` crashed after one call

## What This Rules Out

- The current server does not reproduce a "one successful call, then dead
  server" failure under Claude Code.
- The current server does not jam the queue after a timed-out Codex child in the
  tested recovery path.
- The resumed Claude session itself is not inherently broken.

## Remaining Rough Edges

These are real follow-up candidates, but they are not the root cause of the
hang investigated here.

### Timeout tuning

`CODEX_TOOL_TIMEOUT_MS` exists and works, and callers can now override it per
request with `timeoutMs`. The default `120000` can still be too short for large
real Codex tasks.

Suggested cleanup:

- document the env var and per-call override clearly
- consider revisiting the default timeout once more real Codex latency data is available

## Practical Conclusion

At this point the server-side lifecycle and queue bugs are fixed well enough for
Claude-driven use:

- single live calls work
- sequential live calls work
- resumed-session live calls work
- timeout followed by another call works
- startup debug noise is off by default
- reported server version matches the package version

If a user still sees a hang now, the next place to investigate is no longer the
original stdio race. It is more likely to be one of:

- a real long-running Codex API call
- Claude-side tool selection or control-flow behavior
- an environment-specific issue outside the fixed queue/timeout path

## Final Verification

Final verification after the startup-noise and version-drift cleanup:

### Repo Checks

- `npm run lint` — PASS
- `npm run format:check` — PASS
- `npm run build` — PASS
- `npm test -- --runInBand` — PASS (`13/13` suites, `88/88` tests)

### Focused Regression Checks

- `npm test -- --runInBand src/__tests__/runtime-config.test.ts src/__tests__/startup-logging.test.ts src/__tests__/mcp-lifecycle.test.ts --runTestsByPath`
  - PASS (`3/3` suites, `8/8` tests)

### Claude-Facing Verification

A final strict stub-backed Claude probe was used to avoid live Codex account
usage-limit noise while still exercising the Claude MCP client path.

Observed result:

- Claude received `stub stdout`
- Claude debug showed `Calling MCP tool: codex`
- Claude debug showed `Tool 'codex' completed successfully`
- the old startup line `Server stderr: codex-mcp-server started successfully`
  was absent
- a strict stub-backed override probe returned:
  - `Error in tool "codex": Tool call timed out after 100ms`
  - `stub stdout`

This confirms the final build still works through Claude and the startup banner
no longer pollutes Claude's debug log by default, and that `timeoutMs`
overrides the global timeout without jamming the queue.
