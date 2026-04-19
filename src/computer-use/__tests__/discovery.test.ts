import { discoverBinary } from '../discovery.js';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const hasNpmBinary = (() => {
  try {
    return !!execSync('which open-computer-use 2>/dev/null', { encoding: 'utf-8' }).trim();
  } catch {
    return false;
  }
})();

const hasCodexBinary = existsSync(
  '/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient'
);

const hasBinary = hasNpmBinary || hasCodexBinary;

describe('Binary Discovery', () => {
  (hasBinary ? describe : describe.skip)('with binary available', () => {
    test('should discover a binary', () => {
      const info = discoverBinary();
      expect(info.path).toBeDefined();
      expect(info.args).toEqual(['mcp']);
      expect(['npm-package', 'codex-app', 'custom']).toContain(info.type);
    });
  });

  test('should throw when env var points to non-existent path', () => {
    const original = process.env.CODEX_COMPUTER_USE_BINARY;
    process.env.CODEX_COMPUTER_USE_BINARY = '/nonexistent/path/to/binary';
    try {
      expect(() => discoverBinary()).toThrow('non-existent path');
    } finally {
      if (original) {
        process.env.CODEX_COMPUTER_USE_BINARY = original;
      } else {
        delete process.env.CODEX_COMPUTER_USE_BINARY;
      }
    }
  });
});
