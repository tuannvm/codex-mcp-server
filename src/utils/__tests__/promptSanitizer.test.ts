import { sanitizePrompt } from '../promptSanitizer';

describe('sanitizePrompt', () => {
  it('should remove dangerous shell characters', () => {
    const input = 'echo hello && rm -rf /';
    const sanitized = sanitizePrompt(input);
    expect(sanitized).not.toContain('&&');
    expect(sanitized).not.toContain('rm -rf');
  });

  it('should allow safe prompts', () => {
    const input = 'What is the weather today?';
    const sanitized = sanitizePrompt(input);
    expect(sanitized).toBe(input);
  });
});
