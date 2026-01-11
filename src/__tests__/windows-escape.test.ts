import { escapeArgForWindowsShell } from '../utils/escape.js';

describe('escapeArgForWindowsShell', () => {
  describe('basic arguments', () => {
    test('should not modify simple arguments without special chars', () => {
      expect(escapeArgForWindowsShell('hello')).toBe('hello');
      expect(escapeArgForWindowsShell('--flag')).toBe('--flag');
      expect(escapeArgForWindowsShell('-x')).toBe('-x');
      expect(escapeArgForWindowsShell('filename.txt')).toBe('filename.txt');
    });

    test('should wrap arguments with spaces in double quotes', () => {
      expect(escapeArgForWindowsShell('hello world')).toBe('"hello world"');
      expect(escapeArgForWindowsShell('path with spaces')).toBe(
        '"path with spaces"'
      );
    });
  });

  describe('percent signs', () => {
    test('should escape percent signs to prevent env var expansion', () => {
      expect(escapeArgForWindowsShell('100%')).toBe('100%%');
      expect(escapeArgForWindowsShell('%PATH%')).toBe('%%PATH%%');
      expect(escapeArgForWindowsShell('50% off')).toBe('"50%% off"');
    });
  });

  describe('newlines', () => {
    test('should replace newlines with spaces', () => {
      expect(escapeArgForWindowsShell('line1\nline2')).toBe('"line1 line2"');
      expect(escapeArgForWindowsShell('line1\r\nline2')).toBe('"line1 line2"');
      expect(escapeArgForWindowsShell('a\n\n\nb')).toBe('"a b"');
    });

    test('should handle multiline prompts', () => {
      const multilinePrompt = 'First line\nSecond line\nThird line';
      const result = escapeArgForWindowsShell(multilinePrompt);
      expect(result).toBe('"First line Second line Third line"');
      expect(result).not.toContain('\n');
    });
  });

  describe('quotes', () => {
    test('should escape quotes with caret when no spaces present', () => {
      // In practice, -c and model="gpt-5" are separate args in the array
      // So we test model="gpt-5" alone (no spaces)
      expect(escapeArgForWindowsShell('model="gpt-5"')).toBe('model=^"gpt-5^"');
      expect(escapeArgForWindowsShell('key="value"')).toBe('key=^"value^"');
      expect(escapeArgForWindowsShell('"quoted"')).toBe('^"quoted^"');
    });

    test('should double quotes when wrapped in outer quotes (has spaces)', () => {
      // When arg has spaces AND quotes, wrap in quotes and double internal quotes
      expect(escapeArgForWindowsShell('say "hello"')).toBe('"say ""hello"""');
      expect(escapeArgForWindowsShell('text with "quotes" inside')).toBe(
        '"text with ""quotes"" inside"'
      );
      // This is a single arg with space - gets wrapped
      expect(escapeArgForWindowsShell('-c model="gpt-5"')).toBe(
        '"-c model=""gpt-5"""'
      );
    });
  });

  describe('special shell characters', () => {
    test('should wrap args with shell metacharacters in quotes', () => {
      expect(escapeArgForWindowsShell('a&b')).toBe('"a&b"');
      expect(escapeArgForWindowsShell('a|b')).toBe('"a|b"');
      expect(escapeArgForWindowsShell('a<b')).toBe('"a<b"');
      expect(escapeArgForWindowsShell('a>b')).toBe('"a>b"');
      expect(escapeArgForWindowsShell('a^b')).toBe('"a^b"');
    });
  });

  describe('complex real-world cases', () => {
    test('should handle codex config arguments', () => {
      // This is a common pattern: -c key="value"
      const result = escapeArgForWindowsShell('model="gpt-5.2-codex"');
      expect(result).toBe('model=^"gpt-5.2-codex^"');
    });

    test('should handle prompts with special characters', () => {
      const prompt = 'What is 50% of 100?';
      const result = escapeArgForWindowsShell(prompt);
      expect(result).toBe('"What is 50%% of 100?"');
    });

    test('should handle JSON-like arguments', () => {
      const jsonArg = '{"key":"value"}';
      const result = escapeArgForWindowsShell(jsonArg);
      expect(result).toBe('{^"key^":^"value^"}');
    });

    test('should handle paths with spaces', () => {
      const path = 'C:\\Program Files\\App\\file.exe';
      const result = escapeArgForWindowsShell(path);
      expect(result).toBe('"C:\\Program Files\\App\\file.exe"');
    });

    test('should handle empty string', () => {
      expect(escapeArgForWindowsShell('')).toBe('');
    });
  });

  describe('combined escaping', () => {
    test('should handle multiple escape requirements', () => {
      // Spaces + percent
      expect(escapeArgForWindowsShell('100% complete')).toBe('"100%% complete"');

      // Newline + spaces
      expect(escapeArgForWindowsShell('line1\nwith spaces')).toBe(
        '"line1 with spaces"'
      );

      // Percent + quotes (no spaces)
      expect(escapeArgForWindowsShell('rate=100%')).toBe('rate=100%%');
    });
  });
});
