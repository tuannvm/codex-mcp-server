# Configuration

Set these env vars in your editor/terminal as needed:

```bash
export OPENAI_API_KEY=...           # Required by Codex CLI unless logged in
export CODEX_PAGE_SIZE=40000        # Optional default page size
export CODEX_SESSION_TTL_MS=3600000 # Optional session TTL (ms)
export CODEX_SESSION_MAX_BYTES=400000
```

> The server itself runs over **stdio** (Model Context Protocol). No ports required.
