# Tools API

## codex

Runs the local **Codex CLI** using streamed execution. The server strips prompt/context echoes and returns clean output. Large responses are paginated automatically.

**Environment variables**

- `CODEX_PAGE_SIZE` — default page size (min 1000, max 200000). Default: 40000.
- `CODEX_SESSION_TTL_MS` — in‑memory session TTL (default 1 hour).
- `CODEX_SESSION_MAX_BYTES` — max transcript bytes kept per session (~400 KB default).

## listSessions
Returns known session IDs.

## ping
Simple echo; defaults to `pong`.

## help
Prints `codex --help` for quick reference.
