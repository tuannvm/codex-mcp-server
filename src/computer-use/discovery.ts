import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { type BinaryInfo } from './types.js';

const CODEX_APP_PATH =
  '/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use';
const CODEX_BINARY = join(
  CODEX_APP_PATH,
  'Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient'
);

export function discoverBinary(): BinaryInfo {
  // 1. Explicit env var override.
  const envPath = process.env.CODEX_COMPUTER_USE_BINARY;
  if (envPath) {
    const resolved = resolve(envPath);
    if (!existsSync(resolved)) {
      throw new Error(
        `CODEX_COMPUTER_USE_BINARY points to non-existent path: ${resolved}`
      );
    }
    return { path: resolved, type: 'custom', args: ['mcp'] };
  }

  // 2. Codex.app bundled binary (SkyComputerUseClient).
  if (existsSync(CODEX_BINARY)) {
    return { path: CODEX_BINARY, type: 'codex-app', args: ['mcp'] };
  }

  throw new Error(
    'Computer Use binary not found.\n' +
      'Install Codex.app from https://codex.ai or set CODEX_COMPUTER_USE_BINARY env var.'
  );
}
