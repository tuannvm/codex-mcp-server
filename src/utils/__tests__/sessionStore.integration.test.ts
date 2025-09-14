import { appendTurn, getTranscript, clearSession, listSessionIds } from '../sessionStore';

describe('sessionStore integration', () => {
  it('should append and retrieve turns', () => {
    const id = 'session1';
    appendTurn(id, 'user', 'hello');
    appendTurn(id, 'assistant', 'hi');
    const turns = getTranscript(id);
    expect(turns?.length).toBe(2);
    expect(turns?.[0].role).toBe('user');
    expect(turns?.[1].role).toBe('assistant');
  });

  it('should clear session', () => {
    const id = 'session2';
    appendTurn(id, 'user', 'bye');
    clearSession(id);
    expect(getTranscript(id)).toBeUndefined();
  });

  it('should list session ids', () => {
    const id = 'session3';
    appendTurn(id, 'user', 'foo');
    expect(listSessionIds()).toContain(id);
  });
});
