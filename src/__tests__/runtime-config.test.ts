import path from 'path';
import { readFileSync } from 'fs';

import { CodexToolSchema } from '../types.js';
import {
  COMMAND_LOG_ENV_VAR,
  SERVER_CONFIG,
  STARTUP_LOG_ENV_VAR,
  getServerVersion,
  isCommandLoggingEnabled,
  isStartupLoggingEnabled,
} from '../runtime-config.js';

describe('runtime config', () => {
  test('uses package version for server config', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version: string;
    };

    expect(SERVER_CONFIG.name).toBe('codex-mcp-server');
    // Test getServerVersion with an explicit path to avoid cwd/argv sensitivity
    expect(getServerVersion(path.join(process.cwd(), 'dist/index.js'))).toBe(
      packageJson.version
    );
  });

  test('startup logging is disabled by default', () => {
    expect(isStartupLoggingEnabled({})).toBe(false);
  });

  test('startup logging can be enabled via env var', () => {
    expect(isStartupLoggingEnabled({ [STARTUP_LOG_ENV_VAR]: '1' })).toBe(true);
    expect(isStartupLoggingEnabled({ [STARTUP_LOG_ENV_VAR]: 'true' })).toBe(
      true
    );
  });

  test('command logging is disabled by default', () => {
    expect(isCommandLoggingEnabled({})).toBe(false);
  });

  test('command logging can be enabled via env var', () => {
    expect(isCommandLoggingEnabled({ [COMMAND_LOG_ENV_VAR]: '1' })).toBe(true);
    expect(isCommandLoggingEnabled({ [COMMAND_LOG_ENV_VAR]: 'yes' })).toBe(
      true
    );
  });

  test('codex schema accepts a positive timeout override', () => {
    const parsedArgs = CodexToolSchema.parse({
      prompt: 'test prompt',
      timeoutMs: 250,
    });

    expect(parsedArgs).toEqual(expect.objectContaining({ timeoutMs: 250 }));
  });

  test('codex schema rejects invalid timeout overrides', () => {
    expect(() =>
      CodexToolSchema.parse({
        prompt: 'test prompt',
        timeoutMs: 0,
      })
    ).toThrow();

    expect(() =>
      CodexToolSchema.parse({
        prompt: 'test prompt',
        timeoutMs: -1,
      })
    ).toThrow();

    expect(() =>
      CodexToolSchema.parse({
        prompt: 'test prompt',
        timeoutMs: 12.5,
      })
    ).toThrow();
  });
});
