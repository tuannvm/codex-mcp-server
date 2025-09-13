// src/cursorStore.ts
type Entry = { remaining: string; expiresAt: number };
const store = new Map<string, Entry>();
const TTL_MS = 10 * 60 * 1000;

function gc() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt < now) store.delete(k);
}

export function advanceChunk(cursor: string, consumed: number): void {
  gc();
  const entry = store.get(cursor);
  if (!entry) return;
  const remaining = entry.remaining.slice(consumed);
  if (remaining.length === 0) {
    store.delete(cursor);
    return;
  }
  store.set(cursor, {
    remaining,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function saveChunk(remaining: string): string {
  gc();
  const id =
    (globalThis.crypto?.randomUUID?.() ??
      Math.random().toString(36).slice(2)) + Date.now().toString(36);
  store.set(id, { remaining, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function peekChunk(cursor: string): string | undefined {
  gc();
  const entry = store.get(cursor);
  return entry?.remaining;
}
