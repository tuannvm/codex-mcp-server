# Troubleshooting

## "Failed to start server"
- Ensure Node ≥ 18.18.
- Make sure `@openai/codex` is installed and `codex --version` works.

## "Missing required 'prompt'"
- First call must include `prompt` unless you’re passing a valid `pageToken`.

## No output / partial output
- Increase `pageSize` or follow the `nextPageToken`.
- Very large outputs may take time; the CLI is streamed and then paginated.

## Sessions not remembered
- Pass a stable `sessionId`.
- Session transcripts are trimmed when exceeding `CODEX_SESSION_MAX_BYTES` and expire after `CODEX_SESSION_TTL_MS`.

## Windows shells
- Prefer PowerShell or Git Bash; ensure `npx` is available on PATH.
