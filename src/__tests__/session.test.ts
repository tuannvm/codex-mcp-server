import { InMemorySessionStorage } from '../session/storage.js';

describe('InMemorySessionStorage', () => {
  let storage: InMemorySessionStorage;

  beforeEach(() => {
    storage = new InMemorySessionStorage();
  });

  test('should create a new session', () => {
    const sessionId = storage.createSession();
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');

    const session = storage.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.id).toBe(sessionId);
    expect(session?.turns).toEqual([]);
  });

  test('should add turns to a session', () => {
    const sessionId = storage.createSession();
    const turn = {
      prompt: 'Hello',
      response: 'Hi there!',
      timestamp: new Date(),
    };

    storage.addTurn(sessionId, turn);

    const session = storage.getSession(sessionId);
    expect(session?.turns).toHaveLength(1);
    expect(session?.turns[0]).toEqual(turn);
  });

  test('should reset a session', () => {
    const sessionId = storage.createSession();
    storage.addTurn(sessionId, {
      prompt: 'Test',
      response: 'Response',
      timestamp: new Date(),
    });

    expect(storage.getSession(sessionId)?.turns).toHaveLength(1);

    storage.resetSession(sessionId);
    expect(storage.getSession(sessionId)?.turns).toHaveLength(0);
  });

  test('should list all sessions', () => {
    const sessionId1 = storage.createSession();
    const sessionId2 = storage.createSession();

    const sessions = storage.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.id)).toContain(sessionId1);
    expect(sessions.map((s) => s.id)).toContain(sessionId2);
  });

  test('should delete a session', () => {
    const sessionId = storage.createSession();
    expect(storage.getSession(sessionId)).toBeDefined();

    const deleted = storage.deleteSession(sessionId);
    expect(deleted).toBe(true);
    expect(storage.getSession(sessionId)).toBeUndefined();
  });

  test('should return false when deleting non-existent session', () => {
    const deleted = storage.deleteSession('non-existent');
    expect(deleted).toBe(false);
  });
});
