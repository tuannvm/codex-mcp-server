// Covers the trimming loop by forcing a tiny MAX_BYTES at module init time.
import { jest } from '@jest/globals';

beforeAll(() => {
  process.env.CODEX_SESSION_MAX_BYTES = '10'; // very small to force trimming
});

test('trims oldest turns when MAX_BYTES exceeded', async () => {
  // Import fresh after env is set so constants are captured
  const { appendTurn, getTranscript, clearSession } = await import(
    '../sessionStore'
  );

  const id = 'trim-session';
  clearSession(id);
  appendTurn(id, 'user', '1234567890'); // 10 bytes
  appendTurn(id, 'assistant', 'abc'); // exceed -> should trim first turn
  const t = getTranscript(id)!;
  expect(t.length).toBeGreaterThanOrEqual(1);
  // First turn should no longer be the original 'user' long text
  expect(t[0].text).toBe('abc');
});
