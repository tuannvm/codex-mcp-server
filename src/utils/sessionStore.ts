type Turn = { role: 'user' | 'assistant'; text: string; at: number };
type Session = { turns: Turn[]; bytes: number; expiresAt: number };

import { Buffer } from 'buffer';
const SESSIONS = new Map<string, Session>();

// Optionally, group API as an object for convenience
export const SessionStore = {
  appendTurn,
  getTranscript,
  clearSession,
  listSessionIds,
};

const TTL_MS = Number(process.env.CODEX_SESSION_TTL_MS ?? 60 * 60 * 1000); // 1h
const MAX_BYTES = Number(process.env.CODEX_SESSION_MAX_BYTES ?? 400_000); // ~400 KB

function gc() {
  const now = Date.now();
  for (const [k, v] of SESSIONS) if (v.expiresAt < now) SESSIONS.delete(k);
}

export function appendTurn(
  sessionId: string,
  role: 'user' | 'assistant',
  text: string
) {
  gc();
  const existing = SESSIONS.get(sessionId) ?? {
    turns: [],
    bytes: 0,
    expiresAt: 0,
  };
  const turns = [...existing.turns, { role, text, at: Date.now() }];
  let bytes = existing.bytes + Buffer.byteLength(text, 'utf8');
  let idx = 0;
  // Trim from the oldest until within MAX_BYTES
  while (bytes > MAX_BYTES && turns.length - idx > 1) {
    bytes -= Buffer.byteLength(turns[idx].text, 'utf8');
    idx++;
  }
  const next: Session = {
    turns: turns.slice(idx),
    bytes,
    expiresAt: Date.now() + TTL_MS,
  };
  SESSIONS.set(sessionId, next);
}

export function getTranscript(sessionId: string): Turn[] | undefined {
  gc();
  return SESSIONS.get(sessionId)?.turns;
}

export function clearSession(sessionId: string): void {
  gc();
  SESSIONS.delete(sessionId);
}

export function listSessionIds(): string[] {
  gc();
  return Array.from(SESSIONS.keys());
}
