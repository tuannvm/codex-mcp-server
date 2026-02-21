import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileSessionStorage } from '../session/file-storage.js';

function createTmpStorage(): { storage: FileSessionStorage; filePath: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'codex-mcp-test-'));
  const filePath = join(dir, 'sessions.json');
  const storage = new FileSessionStorage(filePath);
  return { storage, filePath, dir };
}

function cleanup(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

describe('FileSessionStorage', () => {
  let dir: string;
  let filePath: string;
  let storage: FileSessionStorage;

  beforeEach(() => {
    ({ storage, filePath, dir } = createTmpStorage());
  });

  afterEach(async () => {
    await storage.flush();
    cleanup(dir);
  });

  // --- Basic CRUD ---

  test('should create a new session', async () => {
    const sessionId = storage.createSession();
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');

    const session = storage.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.id).toBe(sessionId);
    expect(session?.turns).toEqual([]);

    await storage.flush();
  });

  test('should add turns to a session', async () => {
    const sessionId = storage.createSession();
    const turn = {
      prompt: 'Hello',
      response: 'Hi there!',
      timestamp: new Date(),
    };

    storage.addTurn(sessionId, turn);

    const session = storage.getSession(sessionId);
    expect(session?.turns).toHaveLength(1);
    expect(session?.turns[0].prompt).toBe('Hello');

    await storage.flush();
  });

  test('should reset a session', async () => {
    const sessionId = storage.createSession();
    storage.addTurn(sessionId, {
      prompt: 'Test',
      response: 'Response',
      timestamp: new Date(),
    });
    storage.setCodexConversationId(sessionId, 'conv-123');

    expect(storage.getSession(sessionId)?.turns).toHaveLength(1);
    expect(storage.getCodexConversationId(sessionId)).toBe('conv-123');

    storage.resetSession(sessionId);
    expect(storage.getSession(sessionId)?.turns).toHaveLength(0);
    expect(storage.getCodexConversationId(sessionId)).toBeUndefined();

    await storage.flush();
  });

  test('should list all sessions', async () => {
    const sessionId1 = storage.createSession();
    const sessionId2 = storage.createSession();

    const sessions = storage.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.id)).toContain(sessionId1);
    expect(sessions.map((s) => s.id)).toContain(sessionId2);

    await storage.flush();
  });

  test('should delete a session', async () => {
    const sessionId = storage.createSession();
    expect(storage.getSession(sessionId)).toBeDefined();

    const deleted = storage.deleteSession(sessionId);
    expect(deleted).toBe(true);
    expect(storage.getSession(sessionId)).toBeUndefined();

    await storage.flush();
  });

  test('should return false when deleting non-existent session', () => {
    const deleted = storage.deleteSession('non-existent');
    expect(deleted).toBe(false);
  });

  // --- Persistence ---

  test('should persist and restore sessions across instances', async () => {
    const sessionId = storage.createSession();
    storage.addTurn(sessionId, {
      prompt: 'Remember me',
      response: 'I will',
      timestamp: new Date(),
    });
    storage.setCodexConversationId(sessionId, 'conv-abc');

    await storage.flush();

    // Create new instance from same file
    const storage2 = new FileSessionStorage(filePath);
    const session = storage2.getSession(sessionId);

    expect(session).toBeDefined();
    expect(session?.turns).toHaveLength(1);
    expect(session?.turns[0].prompt).toBe('Remember me');
    expect(session?.codexConversationId).toBe('conv-abc');

    await storage2.flush();
  });

  test('should restore Date objects correctly', async () => {
    const sessionId = storage.createSession();
    const now = new Date();
    storage.addTurn(sessionId, {
      prompt: 'test',
      response: 'test',
      timestamp: now,
    });

    await storage.flush();

    const storage2 = new FileSessionStorage(filePath);
    const session = storage2.getSession(sessionId);

    expect(session?.createdAt).toBeInstanceOf(Date);
    expect(session?.lastAccessedAt).toBeInstanceOf(Date);
    expect(session?.turns[0].timestamp).toBeInstanceOf(Date);

    await storage2.flush();
  });

  test('should restore codexConversationId correctly', async () => {
    const sessionId = storage.createSession();
    storage.setCodexConversationId(sessionId, 'conv-xyz-123');

    await storage.flush();

    const storage2 = new FileSessionStorage(filePath);
    expect(storage2.getCodexConversationId(sessionId)).toBe('conv-xyz-123');

    await storage2.flush();
  });

  // --- Error Recovery ---

  test('should handle missing file gracefully (first run)', () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'codex-mcp-fresh-'));
    const freshPath = join(freshDir, 'nonexistent.json');
    const freshStorage = new FileSessionStorage(freshPath);

    expect(freshStorage.listSessions()).toEqual([]);
    cleanup(freshDir);
  });

  test('should backup corrupted JSON and start fresh', async () => {
    writeFileSync(filePath, 'NOT VALID JSON {{{', 'utf-8');

    const recoveredStorage = new FileSessionStorage(filePath);
    expect(recoveredStorage.listSessions()).toEqual([]);

    // Should be able to work normally
    const sessionId = recoveredStorage.createSession();
    expect(recoveredStorage.getSession(sessionId)).toBeDefined();

    await recoveredStorage.flush();
  });

  test('should reject unsupported future schema version', () => {
    writeFileSync(filePath, JSON.stringify({ version: 999, sessions: [] }), 'utf-8');

    // Should backup and start fresh (treated as corrupted)
    const futureStorage = new FileSessionStorage(filePath);
    expect(futureStorage.listSessions()).toEqual([]);
  });

  test('should clean up leftover tmp files', async () => {
    const tmpFile = `${filePath}.12345.tmp`;
    writeFileSync(tmpFile, 'leftover', 'utf-8');

    // Constructor should clean up tmp files
    const cleanStorage = new FileSessionStorage(filePath);
    expect(() => readFileSync(tmpFile)).toThrow();

    await cleanStorage.flush();
  });

  // --- TTL / LRU ---

  test('should clean up expired sessions', async () => {
    const sessionId = storage.createSession();
    const session = storage.getSession(sessionId);

    // Manually set lastAccessedAt to 25 hours ago
    if (session) {
      session.lastAccessedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    }

    // ensureSession triggers cleanup
    storage.ensureSession('trigger-cleanup');
    expect(storage.getSession(sessionId)).toBeUndefined();

    await storage.flush();
  });

  test('should enforce max 100 sessions (LRU)', async () => {
    for (let i = 0; i < 105; i++) {
      storage.createSession();
    }

    const sessions = storage.listSessions();
    expect(sessions.length).toBeLessThanOrEqual(100);

    await storage.flush();
  });

  // --- Atomic Save ---

  test('should write valid JSON to disk', async () => {
    const sessionId = storage.createSession();
    storage.addTurn(sessionId, {
      prompt: 'test',
      response: 'response',
      timestamp: new Date(),
    });

    await storage.flush();

    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    expect(data.version).toBe(1);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].id).toBe(sessionId);
  });

  test('should set file permissions to 0o600', async () => {
    storage.createSession();
    await storage.flush();

    const stat = statSync(filePath);
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  // --- Save Serialization ---

  test('should not lose data with rapid consecutive changes', async () => {
    const id1 = storage.createSession();
    const id2 = storage.createSession();
    storage.addTurn(id1, { prompt: 'a', response: 'b', timestamp: new Date() });
    storage.addTurn(id2, { prompt: 'c', response: 'd', timestamp: new Date() });
    storage.setCodexConversationId(id1, 'conv-1');

    await storage.flush();

    const storage2 = new FileSessionStorage(filePath);
    expect(storage2.getSession(id1)?.turns).toHaveLength(1);
    expect(storage2.getSession(id2)?.turns).toHaveLength(1);
    expect(storage2.getCodexConversationId(id1)).toBe('conv-1');

    await storage2.flush();
  });

  test('should persist data after flush', async () => {
    const sessionId = storage.createSession();
    await storage.flush();

    // Verify file exists and has data
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    expect(data.sessions.find((s: { id: string }) => s.id === sessionId)).toBeDefined();
  });

  // --- Schema ---

  test('should load v1 schema correctly', async () => {
    const v1Data = {
      version: 1,
      sessions: [
        {
          id: 'test-session',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastAccessedAt: '2026-01-01T00:00:00.000Z',
          turns: [{ prompt: 'hi', response: 'hello', timestamp: '2026-01-01T00:00:00.000Z' }],
          codexConversationId: 'conv-v1',
        },
      ],
    };

    writeFileSync(filePath, JSON.stringify(v1Data), 'utf-8');

    const v1Storage = new FileSessionStorage(filePath);
    const session = v1Storage.getSession('test-session');

    expect(session).toBeDefined();
    expect(session?.turns[0].prompt).toBe('hi');
    expect(session?.codexConversationId).toBe('conv-v1');
    expect(session?.createdAt).toBeInstanceOf(Date);

    await v1Storage.flush();
  });

  // --- ensureSession ---

  test('should create session with custom ID via ensureSession', async () => {
    storage.ensureSession('my-custom-id');

    const session = storage.getSession('my-custom-id');
    expect(session).toBeDefined();
    expect(session?.id).toBe('my-custom-id');

    await storage.flush();
  });

  test('should reject invalid session IDs', () => {
    expect(() => storage.ensureSession('bad\x00id')).toThrow();
    expect(() => storage.ensureSession('')).toThrow();
  });
});
