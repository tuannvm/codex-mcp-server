import { SessionStore } from '../sessionStore';

describe('SessionStore', () => {

  it('should append and get transcript', () => {
    SessionStore.clearSession('id1');
    SessionStore.appendTurn('id1', 'user', 'hello');
    const transcript = SessionStore.getTranscript('id1');
    expect(transcript).toBeDefined();
    expect(transcript?.[0].role).toBe('user');
    expect(transcript?.[0].text).toBe('hello');
  });

  it('should return undefined for unknown id', () => {
    expect(SessionStore.getTranscript('unknown')).toBeUndefined();
  });

  it('should clear a session', () => {
    SessionStore.appendTurn('id2', 'assistant', 'bye');
    SessionStore.clearSession('id2');
    expect(SessionStore.getTranscript('id2')).toBeUndefined();
  });
});
