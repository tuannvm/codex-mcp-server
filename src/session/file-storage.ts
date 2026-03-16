import {
  readFileSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  readdirSync,
} from 'fs';
import { writeFile, rename } from 'fs/promises';
import { dirname, join, basename } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { TOOLS } from '../types.js';
import { ValidationError } from '../errors.js';
import type {
  SessionStorage,
  SessionData,
  ConversationTurn,
} from './storage.js';

const SCHEMA_VERSION = 1;
const DEFAULT_PATH = join(homedir(), '.codex-mcp', 'sessions.json');

interface StorageFile {
  version: number;
  sessions: SerializedSession[];
}

interface SerializedSession {
  id: string;
  createdAt: string;
  lastAccessedAt: string;
  turns: { prompt: string; response: string; timestamp: string }[];
  codexConversationId?: string;
}

export class FileSessionStorage implements SessionStorage {
  private sessions = new Map<string, SessionData>();
  private readonly filePath: string;
  private readonly maxSessions = 100;
  private readonly sessionTtl = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxSessionIdLength = 256;
  // eslint-disable-next-line no-control-regex
  private readonly sessionIdPattern = /^[^\x00-\x1f\x7f]+$/;

  private dirty = false;
  private saving = false;
  private pendingSave: Promise<void> | null = null;

  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_PATH;
    this.loadSync();
    this.cleanupTmpFiles();
  }

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
    this.queueSave();
    return sessionId;
  }

  ensureSession(sessionId: string): void {
    this.cleanupExpiredSessions();

    if (
      !sessionId ||
      sessionId.length > this.maxSessionIdLength ||
      !this.sessionIdPattern.test(sessionId)
    ) {
      throw new ValidationError(
        TOOLS.CODEX,
        'Session ID must not contain control characters'
      );
    }

    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.lastAccessedAt = new Date();
      this.queueSave();
      return;
    }

    const now = new Date();
    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: now,
      lastAccessedAt: now,
      turns: [],
    });

    this.enforceMaxSessions();
    this.queueSave();
  }

  getSession(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
      this.queueSave();
    }
    return session;
  }

  updateSession(sessionId: string, data: Partial<SessionData>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, data);
      session.lastAccessedAt = new Date();
      this.queueSave();
    }
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.queueSave();
    }
    return deleted;
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
      if (!Array.isArray(session.turns)) {
        session.turns = [];
      }
      session.turns.push(turn);
      session.lastAccessedAt = new Date();
      this.queueSave();
    }
  }

  resetSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.turns = [];
      session.codexConversationId = undefined;
      session.lastAccessedAt = new Date();
      this.queueSave();
    }
  }

  setCodexConversationId(sessionId: string, conversationId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.codexConversationId = conversationId;
      session.lastAccessedAt = new Date();
      this.queueSave();
    }
  }

  getCodexConversationId(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.codexConversationId;
  }

  /** Flush pending saves to disk. For testing and graceful shutdown. */
  async flush(): Promise<void> {
    // Wait for any in-progress saves to settle
    while (this.pendingSave) {
      await this.pendingSave;
    }
    // Ensure current state is on disk
    this.dirty = false;
    await this.executeSave();
  }

  // --- Private: Persistence ---

  private loadSync(): void {
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      const data: StorageFile = JSON.parse(raw);
      this.validateAndMigrate(data);

      for (const s of data.sessions) {
        this.sessions.set(s.id, {
          id: s.id,
          createdAt: new Date(s.createdAt),
          lastAccessedAt: new Date(s.lastAccessedAt),
          turns: s.turns.map((t) => ({
            prompt: t.prompt,
            response: t.response,
            timestamp: new Date(t.timestamp),
          })),
          codexConversationId: s.codexConversationId,
        });
      }
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'ENOENT') {
        // File doesn't exist yet — normal first run
        return;
      }
      if (error.code === 'EACCES') {
        throw error; // Fatal: permission denied
      }
      // JSON corruption or other error — backup and start fresh
      this.backupCorruptedFile();
    }
  }

  private validateAndMigrate(data: StorageFile): void {
    if (
      !data ||
      typeof data.version !== 'number' ||
      !Array.isArray(data.sessions)
    ) {
      throw new Error('Invalid storage file format');
    }
    if (data.version > SCHEMA_VERSION) {
      throw new Error(`Unsupported schema version: ${data.version}`);
    }
    // v1 is current — no migration needed
  }

  private backupCorruptedFile(): void {
    try {
      const backupPath = `${this.filePath}.${Date.now()}.bak`;
      renameSync(this.filePath, backupPath);
    } catch {
      // Best-effort backup — if it fails, continue with empty state
    }
  }

  private serialize(): string {
    const sessions: SerializedSession[] = Array.from(
      this.sessions.values()
    ).map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      lastAccessedAt: s.lastAccessedAt.toISOString(),
      turns: s.turns.map((t) => ({
        prompt: t.prompt,
        response: t.response,
        timestamp: t.timestamp.toISOString(),
      })),
      ...(s.codexConversationId && {
        codexConversationId: s.codexConversationId,
      }),
    }));

    const file: StorageFile = { version: SCHEMA_VERSION, sessions };
    return JSON.stringify(file, null, 2);
  }

  private queueSave(): void {
    this.dirty = true;

    if (this.saving) {
      // A save is already running — it will pick up dirty flag when done
      return;
    }

    // Debounce: schedule save on next tick
    this.dirty = false;
    this.saving = true;
    this.pendingSave = this.executeSave().finally(() => {
      this.saving = false;
      this.pendingSave = null;

      // If more changes came in during save, trigger another
      if (this.dirty) {
        this.queueSave();
      }
    });
  }

  private async executeSave(): Promise<void> {
    try {
      const dir = dirname(this.filePath);
      mkdirSync(dir, { recursive: true, mode: 0o700 });

      const tmpPath = `${this.filePath}.${process.pid}.tmp`;
      const content = this.serialize();

      await writeFile(tmpPath, content, { mode: 0o600 });
      await rename(tmpPath, this.filePath);
    } catch {
      // Non-fatal: data is still in memory
    }
  }

  private cleanupTmpFiles(): void {
    try {
      const dir = dirname(this.filePath);
      const base = basename(this.filePath);
      const files = readdirSync(dir);

      for (const file of files) {
        if (file.startsWith(base) && file.endsWith('.tmp')) {
          try {
            unlinkSync(join(dir, file));
          } catch {
            // Ignore cleanup failures
          }
        }
      }
    } catch {
      // Directory may not exist yet
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let changed = false;
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccessedAt.getTime() > this.sessionTtl) {
        this.sessions.delete(sessionId);
        changed = true;
      }
    }
    if (changed) {
      this.queueSave();
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
