import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  statSync,
  chmodSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileSessionStorage } from '../session/file-storage.js';

function createTmpStorage(): {
  storage: FileSessionStorage;
  filePath: string;
  dir: string;
} {
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

  test('should throw on filesystem errors like EISDIR', () => {
    // Use a directory path as filePath — readFileSync will throw EISDIR
    const dirAsFile = mkdtempSync(join(tmpdir(), 'codex-mcp-eisdir-'));
    expect(() => new FileSessionStorage(dirAsFile)).toThrow();
    cleanup(dirAsFile);
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
    writeFileSync(
      filePath,
      JSON.stringify({ version: 999, sessions: [] }),
      'utf-8'
    );

    // Should backup and start fresh (treated as corrupted)
    const futureStorage = new FileSessionStorage(filePath);
    expect(futureStorage.listSessions()).toEqual([]);
  });

  test('should skip sessions with invalid dates', () => {
    const data = {
      version: 1,
      sessions: [
        {
          id: 'good-session',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastAccessedAt: '2026-01-01T00:00:00.000Z',
          turns: [],
        },
        {
          id: 'bad-session',
          createdAt: 'not-a-date',
          lastAccessedAt: '2026-01-01T00:00:00.000Z',
          turns: [],
        },
      ],
    };
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    const spy = jest.spyOn(console, 'error').mockImplementation();
    const loaded = new FileSessionStorage(filePath);

    expect(loaded.getSession('good-session')).toBeDefined();
    expect(loaded.getSession('bad-session')).toBeUndefined();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('skipping session bad-session')
    );
    spy.mockRestore();
  });

  test('should skip turns with invalid timestamps', () => {
    const data = {
      version: 1,
      sessions: [
        {
          id: 'session-with-bad-turn',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastAccessedAt: '2026-01-01T00:00:00.000Z',
          turns: [
            {
              prompt: 'good',
              response: 'ok',
              timestamp: '2026-01-01T00:00:00.000Z',
            },
            { prompt: 'bad', response: 'fail', timestamp: 'invalid' },
          ],
        },
      ],
    };
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    const spy = jest.spyOn(console, 'error').mockImplementation();
    const loaded = new FileSessionStorage(filePath);

    const session = loaded.getSession('session-with-bad-turn');
    expect(session?.turns).toHaveLength(1);
    expect(session?.turns[0].prompt).toBe('good');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('skipping turn'));
    spy.mockRestore();
  });

  test('should handle all-invalid-date sessions gracefully', () => {
    const data = {
      version: 1,
      sessions: [
        { id: 's1', createdAt: 'bad', lastAccessedAt: 'bad', turns: [] },
        { id: 's2', createdAt: 'bad', lastAccessedAt: 'bad', turns: [] },
      ],
    };
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    const spy = jest.spyOn(console, 'error').mockImplementation();
    const loaded = new FileSessionStorage(filePath);
    expect(loaded.listSessions()).toEqual([]);
    spy.mockRestore();
  });

  test('should not delete other instances tmp files', async () => {
    const otherTmpFile = `${filePath}.other-uuid.tmp`;
    writeFileSync(otherTmpFile, 'leftover', 'utf-8');

    // Constructor should NOT delete tmp files from other instances
    const cleanStorage = new FileSessionStorage(filePath);
    expect(readFileSync(otherTmpFile, 'utf-8')).toBe('leftover');

    await cleanStorage.flush();
    unlinkSync(otherTmpFile);
  });

  test('should use unique tmp suffix per instance', async () => {
    const storage1 = new FileSessionStorage(filePath);
    const storage2 = new FileSessionStorage(filePath);

    storage1.createSession();
    storage2.createSession();

    await storage1.flush();
    await storage2.flush();

    // Final file should be valid JSON (no corruption from shared tmp path)
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    expect(data.version).toBe(1);
    expect(Array.isArray(data.sessions)).toBe(true);

    await storage1.flush();
    await storage2.flush();
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
    expect(
      data.sessions.find((s: { id: string }) => s.id === sessionId)
    ).toBeDefined();
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
          turns: [
            {
              prompt: 'hi',
              response: 'hello',
              timestamp: '2026-01-01T00:00:00.000Z',
            },
          ],
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

  // --- Error Propagation ---

  test('flush should reject when write fails', async () => {
    // Create storage with a valid path, then make the directory unwritable
    const tempDir = mkdtempSync(join(tmpdir(), 'codex-mcp-badwrite-'));
    const validPath = join(tempDir, 'sessions.json');
    const badStorage = new FileSessionStorage(validPath);
    badStorage.createSession();

    // Make directory unwritable after construction
    chmodSync(tempDir, 0o444);

    await expect(badStorage.flush()).rejects.toThrow();

    chmodSync(tempDir, 0o755);
    cleanup(tempDir);
  });

  test('background save failure should log error and not auto-retry', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();

    // Create storage with a valid path
    const tempDir = mkdtempSync(join(tmpdir(), 'codex-mcp-bgfail-'));
    const validPath = join(tempDir, 'sessions.json');
    const badStorage = new FileSessionStorage(validPath);

    // Make directory unwritable to cause save failure
    chmodSync(tempDir, 0o444);

    // Trigger a background save
    badStorage.createSession();

    // Wait for the background save to complete
    await new Promise((r) => globalThis.setTimeout(r, 100));

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[FileSessionStorage] save failed:'),
      expect.anything()
    );

    // Count how many save-failed messages — should be exactly 1 (no auto-retry)
    const saveFails = spy.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('[FileSessionStorage] save failed:')
    );
    expect(saveFails).toHaveLength(1);

    spy.mockRestore();
    chmodSync(tempDir, 0o755);
    cleanup(tempDir);
  });

  test('flush should recover after background save failure when path is restored (F7)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const tempDir = mkdtempSync(join(tmpdir(), 'codex-mcp-f7-'));
    const targetPath = join(tempDir, 'sessions.json');
    const recoverStorage = new FileSessionStorage(targetPath);

    // Make dir unwritable to cause background save failure
    chmodSync(tempDir, 0o444);
    recoverStorage.createSession();
    await new Promise((r) => globalThis.setTimeout(r, 100));

    // Verify background save failed
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[FileSessionStorage] save failed:'),
      expect.anything()
    );

    // Restore permissions — no new mutation, just flush()
    chmodSync(tempDir, 0o755);
    await recoverStorage.flush();

    // File should exist with valid data
    const raw = readFileSync(targetPath, 'utf-8');
    const data = JSON.parse(raw);
    expect(data.version).toBe(1);
    expect(data.sessions.length).toBeGreaterThan(0);

    spy.mockRestore();
    cleanup(tempDir);
  });

  test('two instances should use different tmp paths (F12/E5)', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'codex-mcp-uuid-'));
    const targetPath = join(tempDir, 'sessions.json');

    const storage1 = new FileSessionStorage(targetPath);
    const storage2 = new FileSessionStorage(targetPath);

    // Verify instances have different UUID suffixes (white-box: access private field)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suffix1 = (storage1 as any).tmpSuffix as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suffix2 = (storage2 as any).tmpSuffix as string;
    expect(suffix1).toBeDefined();
    expect(suffix2).toBeDefined();
    expect(suffix1).not.toBe(suffix2);

    // Both instances can flush without interfering
    storage1.createSession();
    storage2.createSession();
    await storage1.flush();
    await storage2.flush();

    // Final file should be valid JSON
    const raw = readFileSync(targetPath, 'utf-8');
    const data = JSON.parse(raw);
    expect(data.version).toBe(1);
    expect(Array.isArray(data.sessions)).toBe(true);

    cleanup(tempDir);
  });
});
