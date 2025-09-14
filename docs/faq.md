# FAQ

**Is this server stateful?**  
Only if you pass `sessionId`. Otherwise, each call is stateless.

**Can I run this without exposing an HTTP port?**  
Yes—stdio transport only.

**Does it support tool discovery?**  
Yes—`ListTools` returns schemas for all tools.

**How do I clear a session?**  
Call `codex` with `{ "sessionId": "id", "resetSession": true, "prompt": "..." }`.
