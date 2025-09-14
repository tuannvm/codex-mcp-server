# Usage

## Tools overview

- **codex** — run the Codex CLI non‑interactively. Optional conversational context via `sessionId`.
- **listSessions** — list active session IDs (managed in‑memory with TTL).
- **ping** — echo test.
- **help** — `codex --help` output passthrough.

## Codex tool parameters

| Name           | Type    | Default | Notes |
|----------------|---------|---------|-------|
| `prompt`       | string  | —       | Required on first call (unless paging). |
| `pageSize`     | number  | 40000   | 1,000–200,000 chars. |
| `pageToken`    | string  | —       | From previous paged response. |
| `sessionId`    | string  | —       | Enables conversation memory within size limits. |
| `resetSession` | boolean | false   | Clears given `sessionId` before running. |

### Examples

**Single‑shot**
```json
{ "prompt": "Explain this TypeScript function" }
```

**Paging through large output**
```json
{ "prompt": "Summarize this repository in depth" }
```
_Response includes_ `{ "nextPageToken": "abc..." }` → call again:
```json
{ "pageToken": "abc...", "pageSize": 40000 }
```

**Conversational**
```json
{ "sessionId": "issue-123", "prompt": "Draft tests for utils/sessionStore.ts" }
```
