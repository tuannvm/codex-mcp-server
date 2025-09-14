type Turn = { role: 'user' | 'assistant'; text: string; at: number };
type Session = { turns: Turn[]; bytes: number; expiresAt: number };

const SESSIONS = new Map<string, Session>();

export class SessionStore {
  static appendTurn = appendTurn;
  static getTranscript = getTranscript;
  static clearSession = clearSession;
  static listSessionIds = listSessionIds;
}

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
  const next: Session = {
    turns: [...existing.turns, { role, text, at: Date.now() }],
    bytes: existing.bytes + Buffer.byteLength(text, 'utf8'),
    expiresAt: Date.now() + TTL_MS,
  };

  // Trim from the oldest until within MAX_BYTES
  while (next.bytes > MAX_BYTES && next.turns.length > 1) {
    const first = next.turns.shift()!;
    next.bytes -= Buffer.byteLength(first.text, 'utf8');
  }

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
