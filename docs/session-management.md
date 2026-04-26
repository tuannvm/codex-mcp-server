# Session Management

This server provides lightweight in-memory session management for the `codex`
tool.

## What a Session Is

- A session is keyed by a caller-supplied `sessionId`.
- Valid IDs are `1` to `256` characters and may contain only letters, numbers,
  `_`, and `-`.
- Sessions exist only inside the current server process.
- If the server exits or is restarted, all sessions are lost.

## What the Server Stores

For each session, the server keeps:

- `id`
- `createdAt`
- `lastAccessedAt`
- `turns`
- `codexConversationId` when Codex CLI emits one

Limits:

- TTL: 24 hours of inactivity
- Maximum active sessions: 100

## How Resume Works

1. The first `codex` call with a `sessionId` creates the session.
2. If Codex CLI emits a conversation/session ID, the server stores it.
3. Later calls with the same `sessionId` use `codex exec resume <conversation-id>`.
4. If no native Codex conversation ID exists yet, the server falls back to a
   short prompt-context reconstruction using the most recent turns.

## Resume Constraints

- `sandbox` is not applied on resumed sessions.
- `workingDirectory` is not applied on resumed sessions.
- This server forwards `fullAuto` and `bypassApprovals` on resumed sessions.
  Whether those flags are accepted depends on the installed Codex CLI version.

## MCP Examples

Create or continue a session:

```json
{
  "name": "codex",
  "arguments": {
    "prompt": "Audit this module for race conditions",
    "sessionId": "race-audit"
  }
}
```

Reset a session:

```json
{
  "name": "codex",
  "arguments": {
    "prompt": "Start over from scratch",
    "sessionId": "race-audit",
    "resetSession": true
  }
}
```

List current sessions:

```json
{
  "name": "listSessions",
  "arguments": {}
}
```

## Operational Notes

- `listSessions` only shows sessions for the current running server.
- A caller can choose meaningful IDs like `refactor-auth-flow`; IDs are not
  UUID-only.
- Native Codex resume is preferred when available because it preserves Codex’s
  own conversation state, not just the server’s short turn history.
