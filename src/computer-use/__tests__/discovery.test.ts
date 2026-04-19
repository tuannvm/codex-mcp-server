import { discoverBinary } from '../discovery.js';
import { existsSync } from 'node:fs';

const hasCodexBinary = existsSync(
  '/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient'
);

describe('Binary Discovery', () => {
  (hasCodexBinary ? describe : describe.skip)('with Codex.app installed', () => {
    test('should discover the Codex.app binary', () => {
      const info = discoverBinary();
      expect(info.path).toContain('SkyComputerUseClient');
      expect(info.args).toEqual(['mcp']);
      expect(['codex-app', 'custom']).toContain(info.type);
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
