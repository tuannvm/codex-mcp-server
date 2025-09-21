import { randomUUID } from 'crypto';

export interface ConversationTurn {
  prompt: string;
  response: string;
  timestamp: Date;
}

export interface SessionData {
  id: string;
  createdAt: Date;
  lastAccessedAt: Date;
  turns: ConversationTurn[];
  codexConversationId?: string;
}

export interface SessionStorage {
  createSession(): string;
  getSession(sessionId: string): SessionData | undefined;
  updateSession(sessionId: string, data: Partial<SessionData>): void;
  deleteSession(sessionId: string): boolean;
  listSessions(): SessionData[];
  addTurn(sessionId: string, turn: ConversationTurn): void;
  resetSession(sessionId: string): void;
  setCodexConversationId(sessionId: string, conversationId: string): void;
  getCodexConversationId(sessionId: string): string | undefined;
}

export class InMemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, SessionData>();
  private readonly maxSessions = 100;
  private readonly sessionTtl = 24 * 60 * 60 * 1000; // 24 hours

  createSession(): string {
    this.cleanupExpiredSessions();

    const sessionId = randomUUID();
    const now = new Date();

    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: now,
      lastAccessedAt: now,
      turns: [],
    });

    this.enforceMaxSessions();
    return sessionId;
  }

  getSession(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
    }
    return session;
  }

  updateSession(sessionId: string, data: Partial<SessionData>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, data);
      session.lastAccessedAt = new Date();
    }
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  listSessions(): SessionData[] {
    this.cleanupExpiredSessions();
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime()
    );
  }

  addTurn(sessionId: string, turn: ConversationTurn): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Ensure turns array exists and is valid
      if (!Array.isArray(session.turns)) {
        session.turns = [];
      }
      session.turns.push(turn);
      session.lastAccessedAt = new Date();
    }
  }

  resetSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.turns = [];
      session.codexConversationId = undefined;
      session.lastAccessedAt = new Date();
    }
  }

  setCodexConversationId(sessionId: string, conversationId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.codexConversationId = conversationId;
      session.lastAccessedAt = new Date();
    }
  }

  getCodexConversationId(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.codexConversationId;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccessedAt.getTime() > this.sessionTtl) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private enforceMaxSessions(): void {
    if (this.sessions.size <= this.maxSessions) return;

    const sessions = this.listSessions();
    const sessionsToDelete = sessions.slice(this.maxSessions);

    for (const session of sessionsToDelete) {
      this.sessions.delete(session.id);
    }
  }
}
