import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { type BinaryInfo } from './types.js';

const CODEX_APP_PATH =
  '/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use';
const CODEX_BINARY = join(
  CODEX_APP_PATH,
  'Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient'
);

function findInPath(name: string): string | null {
  try {
    return execSync(`which ${name} 2>/dev/null`, { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

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

  // 2. open-computer-use in PATH (npm global install).
  const npmPath = findInPath('open-computer-use');
  if (npmPath && existsSync(npmPath)) {
    return { path: npmPath, type: 'npm-package', args: ['mcp'] };
  }

  // 3. Codex.app bundled binary.
  if (existsSync(CODEX_BINARY)) {
    return { path: CODEX_BINARY, type: 'codex-app', args: ['mcp'] };
  }

  throw new Error(
    'Computer Use binary not found.\n' +
      'Install one of:\n' +
      '  npm install -g open-codex-computer-use-mcp\n' +
      '  (then run: open-computer-use doctor)\n' +
      'Or set CODEX_COMPUTER_USE_BINARY env var to a custom path.'
  );
}
