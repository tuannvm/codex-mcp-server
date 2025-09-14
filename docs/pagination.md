# Pagination

When output exceeds `pageSize`, the server returns the first slice plus a `nextPageToken`.

1. Call with your initial prompt.
2. If `nextPageToken` is present, call again with `{ "pageToken": "..." }`.
3. Repeat until the token is no longer returned.

Tokens expire after ~10 minutes of inactivity.
