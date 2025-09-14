import {
  sanitizePrompt,
  buildPromptWithSentinels,
  stripEchoesAndMarkers,
} from '../promptSanitizer';

describe('sanitizePrompt', () => {
  it('removes dangerous shell characters', () => {
    const input = 'echo hello && rm -rf /';
    const sanitized = sanitizePrompt(input);
    expect(sanitized).not.toContain('&&');
    expect(sanitized).not.toContain('rm -rf');
  });

  it('allows safe prompts', () => {
    const input = 'What is the weather today?';
    const sanitized = sanitizePrompt(input);
    expect(sanitized).toBe(input);
  });
});

describe('sentinels + strip', () => {
  it('builds prompt without context when stitchedContext is null', () => {
    const p = buildPromptWithSentinels('id', null, 'ask');
    expect(p).toContain('<<USR:id:START>>');
    expect(p).not.toContain('<<CTX:id:START>>');
  });

  it('stripEchoesAndMarkers leaves raw when markers absent', () => {
    const out = stripEchoesAndMarkers('id', null, 'plain output');
    expect(out).toBe('plain output');
  });
});
