import { spawn } from 'child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const JSONRPC_VERSION = '2.0';
const TEST_TIMEOUT_MS = 10000;
type ExitSignal = string | null;

async function ensureBuild(distPath: string): Promise<void> {
  if (existsSync(distPath)) return;
  await execAsync('npm run build');
}

function createCodexStub(): string {
  const stubDir = mkdtempSync(path.join(tmpdir(), 'codex-mcp-life-'));
  const stubPath = path.join(stubDir, 'codex');
  const lockDir = path.join(stubDir, 'active.lock');
  const stubScript = `#!/bin/sh
LOCK_DIR=${JSON.stringify(lockDir)}
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
printf "Not connected\\n" 1>&2
exit 1
fi
cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
sleep 0.2
printf "stub stdout\\n"
printf "thread id: th_lifecycle_123\\n" 1>&2
printf "session id: sess_lifecycle_123\\n" 1>&2
exit 0
`;
  writeFileSync(stubPath, stubScript, { mode: 0o755 });
  chmodSync(stubPath, 0o755);
  return stubDir;
}

function createTimeoutCodexStub(): string {
  const stubDir = mkdtempSync(path.join(tmpdir(), 'codex-mcp-timeout-'));
  const stubPath = path.join(stubDir, 'codex');
  const lockDir = path.join(stubDir, 'active.lock');
  const stubScript = `#!/bin/sh
LOCK_DIR=${JSON.stringify(lockDir)}
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
printf "Not connected\\n" 1>&2
exit 1
fi
cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
if printf "%s" "$*" | grep -q "slow-timeout"; then
  sleep 5
else
  sleep 0.01
fi
printf "stub stdout\\n"
printf "thread id: th_timeout_123\\n" 1>&2
printf "session id: sess_timeout_123\\n" 1>&2
exit 0
`;
  writeFileSync(stubPath, stubScript, { mode: 0o755 });
  chmodSync(stubPath, 0o755);
  return stubDir;
}

describe('MCP server lifecycle', () => {
  jest.setTimeout(TEST_TIMEOUT_MS);

  let server: ReturnType<typeof spawn> | null = null;
  let stubDir: string | null = null;
  let buffer = '';
  let exitCode: number | null = null;
  let exitSignal: ExitSignal = null;
  const pending = new Map<number, (payload: unknown) => void>();

  const sendRequest = (request: Record<string, unknown>) =>
    new Promise<unknown>((resolve, reject) => {
      if (!server?.stdin) {
        reject(new Error('Server stdin not available'));
        return;
      }

      const id = request.id as number;
      const timer = globalThis.setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for response ${id}`));
      }, TEST_TIMEOUT_MS);

      pending.set(id, (payload) => {
        globalThis.clearTimeout(timer);
        resolve(payload);
      });

      server.stdin.write(`${JSON.stringify(request)}\n`);
    });

  beforeAll(async () => {
    const distPath = path.join(process.cwd(), 'dist', 'index.js');
    await ensureBuild(distPath);
    stubDir = createCodexStub();

    server = spawn(process.execPath, [distPath], {
      env: {
        ...process.env,
        PATH: `${stubDir}${path.delimiter}${process.env.PATH}`,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    server.stdout?.setEncoding('utf8');
    server.stdout?.on('data', (chunk: string) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf('\n');

      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          try {
            const payload = JSON.parse(line) as {
              id?: number;
              result?: unknown;
            };

            if (typeof payload.id === 'number') {
              const resolver = pending.get(payload.id);
              if (resolver) {
                resolver(payload.result ?? payload);
                pending.delete(payload.id);
              }
            }
          } catch {
            // Ignore non-JSON output
          }
        }

        newlineIndex = buffer.indexOf('\n');
      }
    });

    server.stderr?.on('data', () => {});
    server.on('exit', (code, signal) => {
      exitCode = code;
      exitSignal = signal;
    });
  });

  afterAll(async () => {
    if (server && exitCode === null && exitSignal === null) {
      server.kill();
      await new Promise((resolve) => server?.once('exit', resolve));
    }

    if (stubDir) {
      rmSync(stubDir, { recursive: true, force: true });
    }
  });

  test('stays alive across sequential codex tool calls', async () => {
    await sendRequest({
      jsonrpc: JSONRPC_VERSION,
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      },
    });

    server?.stdin?.write(
      `${JSON.stringify({
        jsonrpc: JSONRPC_VERSION,
        method: 'notifications/initialized',
        params: {},
      })}\n`
    );

    await sendRequest({
      jsonrpc: JSONRPC_VERSION,
      id: 2,
      method: 'tools/list',
      params: {},
    });

    const firstResponse = (await sendRequest({
      jsonrpc: JSONRPC_VERSION,
      id: 3,
      method: 'tools/call',
      params: { name: 'codex', arguments: { prompt: 'echo hello' } },
    })) as {
      content: Array<{ text: string }>;
    };

    expect(firstResponse.content[0]?.text).toBe('stub stdout\n');
    expect({ exitCode, exitSignal }).toEqual({
      exitCode: null,
      exitSignal: null,
    });

    await new Promise((resolve) => globalThis.setTimeout(resolve, 250));
    expect({ exitCode, exitSignal }).toEqual({
      exitCode: null,
      exitSignal: null,
    });

    const secondResponse = (await sendRequest({
      jsonrpc: JSONRPC_VERSION,
      id: 4,
      method: 'tools/call',
      params: { name: 'codex', arguments: { prompt: 'echo world' } },
    })) as {
      content: Array<{ text: string }>;
    };

    expect(secondResponse.content[0]?.text).toBe('stub stdout\n');
    expect({ exitCode, exitSignal }).toEqual({
      exitCode: null,
      exitSignal: null,
    });
  });

  test('serializes concurrent tools/call requests', async () => {
    const firstResponsePromise = sendRequest({
      jsonrpc: JSONRPC_VERSION,
      id: 5,
      method: 'tools/call',
      params: { name: 'codex', arguments: { prompt: 'echo concurrent one' } },
    });

    const secondResponsePromise = sendRequest({
      jsonrpc: JSONRPC_VERSION,
      id: 6,
      method: 'tools/call',
      params: { name: 'codex', arguments: { prompt: 'echo concurrent two' } },
    });

    const [firstResponse, secondResponse] = (await Promise.all([
      firstResponsePromise,
      secondResponsePromise,
    ])) as Array<{ content: Array<{ text: string }> }>;

    expect(firstResponse.content[0]?.text).toBe('stub stdout\n');
    expect(secondResponse.content[0]?.text).toBe('stub stdout\n');
    expect({ exitCode, exitSignal }).toEqual({
      exitCode: null,
      exitSignal: null,
    });
  });

  test('kills child process on timeout', async () => {
    const distPath = path.join(process.cwd(), 'dist', 'index.js');
    await ensureBuild(distPath);

    const timeoutStubDir = createTimeoutCodexStub();
    let timeoutServer: ReturnType<typeof spawn> | null = null;
    let timeoutBuffer = '';
    let timeoutExitCode: number | null = null;
    let timeoutExitSignal: ExitSignal = null;
    const timeoutPending = new Map<number, (payload: unknown) => void>();

    const sendTimeoutRequest = (request: Record<string, unknown>) =>
      new Promise<unknown>((resolve, reject) => {
        if (!timeoutServer?.stdin) {
          reject(new Error('Timeout test server stdin not available'));
          return;
        }

        const id = request.id as number;
        const timer = globalThis.setTimeout(() => {
          timeoutPending.delete(id);
          reject(new Error(`Timed out waiting for response ${id}`));
        }, TEST_TIMEOUT_MS);

        timeoutPending.set(id, (payload) => {
          globalThis.clearTimeout(timer);
          resolve(payload);
        });

        timeoutServer.stdin.write(`${JSON.stringify(request)}\n`);
      });

    try {
      timeoutServer = spawn(process.execPath, [distPath], {
        env: {
          ...process.env,
          PATH: `${timeoutStubDir}${path.delimiter}${process.env.PATH}`,
          CODEX_TOOL_TIMEOUT_MS: '100',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      timeoutServer.stdout?.setEncoding('utf8');
      timeoutServer.stdout?.on('data', (chunk: string) => {
        timeoutBuffer += chunk;
        let newlineIndex = timeoutBuffer.indexOf('\n');

        while (newlineIndex >= 0) {
          const line = timeoutBuffer.slice(0, newlineIndex).trim();
          timeoutBuffer = timeoutBuffer.slice(newlineIndex + 1);

          if (line) {
            try {
              const payload = JSON.parse(line) as {
                id?: number;
                result?: unknown;
              };

              if (typeof payload.id === 'number') {
                const resolver = timeoutPending.get(payload.id);
                if (resolver) {
                  resolver(payload.result ?? payload);
                  timeoutPending.delete(payload.id);
                }
              }
            } catch {
              // Ignore non-JSON output
            }
          }

          newlineIndex = timeoutBuffer.indexOf('\n');
        }
      });

      timeoutServer.stderr?.on('data', () => {});
      timeoutServer.on('exit', (code, signal) => {
        timeoutExitCode = code;
        timeoutExitSignal = signal;
      });

      await sendTimeoutRequest({
        jsonrpc: JSONRPC_VERSION,
        id: 100,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-timeout', version: '1' },
        },
      });

      timeoutServer.stdin?.write(
        `${JSON.stringify({
          jsonrpc: JSONRPC_VERSION,
          method: 'notifications/initialized',
          params: {},
        })}\n`
      );

      const timedOutResponse = (await sendTimeoutRequest({
        jsonrpc: JSONRPC_VERSION,
        id: 101,
        method: 'tools/call',
        params: { name: 'codex', arguments: { prompt: 'slow-timeout' } },
      })) as {
        content: Array<{ text: string }>;
        isError?: boolean;
      };

      expect(timedOutResponse.isError).toBe(true);
      expect(timedOutResponse.content[0]?.text).toContain(
        'Tool call timed out after 100ms'
      );

      const secondResponse = (await sendTimeoutRequest({
        jsonrpc: JSONRPC_VERSION,
        id: 102,
        method: 'tools/call',
        params: { name: 'codex', arguments: { prompt: 'fast-after-timeout' } },
      })) as {
        content: Array<{ text: string }>;
      };

      expect(secondResponse.content[0]?.text).toBe('stub stdout\n');
      expect({ timeoutExitCode, timeoutExitSignal }).toEqual({
        timeoutExitCode: null,
        timeoutExitSignal: null,
      });
    } finally {
      if (
        timeoutServer &&
        timeoutExitCode === null &&
        timeoutExitSignal === null
      ) {
        timeoutServer.kill();
        await new Promise((resolve) => timeoutServer?.once('exit', resolve));
      }
      rmSync(timeoutStubDir, { recursive: true, force: true });
    }
  });

  test('uses per-call timeout override', async () => {
    const distPath = path.join(process.cwd(), 'dist', 'index.js');
    await ensureBuild(distPath);

    const timeoutStubDir = createTimeoutCodexStub();
    let timeoutServer: ReturnType<typeof spawn> | null = null;
    let timeoutBuffer = '';
    let timeoutExitCode: number | null = null;
    let timeoutExitSignal: ExitSignal = null;
    const timeoutPending = new Map<number, (payload: unknown) => void>();

    const sendTimeoutRequest = (request: Record<string, unknown>) =>
      new Promise<unknown>((resolve, reject) => {
        if (!timeoutServer?.stdin) {
          reject(new Error('Timeout override test server stdin not available'));
          return;
        }

        const id = request.id as number;
        const timer = globalThis.setTimeout(() => {
          timeoutPending.delete(id);
          reject(new Error(`Timed out waiting for response ${id}`));
        }, TEST_TIMEOUT_MS);

        timeoutPending.set(id, (payload) => {
          globalThis.clearTimeout(timer);
          resolve(payload);
        });

        timeoutServer.stdin.write(`${JSON.stringify(request)}\n`);
      });

    try {
      timeoutServer = spawn(process.execPath, [distPath], {
        env: {
          ...process.env,
          PATH: `${timeoutStubDir}${path.delimiter}${process.env.PATH}`,
          CODEX_TOOL_TIMEOUT_MS: '9000',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      timeoutServer.stdout?.setEncoding('utf8');
      timeoutServer.stdout?.on('data', (chunk: string) => {
        timeoutBuffer += chunk;
        let newlineIndex = timeoutBuffer.indexOf('\n');

        while (newlineIndex >= 0) {
          const line = timeoutBuffer.slice(0, newlineIndex).trim();
          timeoutBuffer = timeoutBuffer.slice(newlineIndex + 1);

          if (line) {
            try {
              const payload = JSON.parse(line) as {
                id?: number;
                result?: unknown;
              };

              if (typeof payload.id === 'number') {
                const resolver = timeoutPending.get(payload.id);
                if (resolver) {
                  resolver(payload.result ?? payload);
                  timeoutPending.delete(payload.id);
                }
              }
            } catch {
              // Ignore non-JSON output
            }
          }

          newlineIndex = timeoutBuffer.indexOf('\n');
        }
      });

      timeoutServer.stderr?.on('data', () => {});
      timeoutServer.on('exit', (code, signal) => {
        timeoutExitCode = code;
        timeoutExitSignal = signal;
      });

      await sendTimeoutRequest({
        jsonrpc: JSONRPC_VERSION,
        id: 200,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-timeout-override', version: '1' },
        },
      });

      timeoutServer.stdin?.write(
        `${JSON.stringify({
          jsonrpc: JSONRPC_VERSION,
          method: 'notifications/initialized',
          params: {},
        })}\n`
      );

      const timedOutResponse = (await sendTimeoutRequest({
        jsonrpc: JSONRPC_VERSION,
        id: 201,
        method: 'tools/call',
        params: {
          name: 'codex',
          arguments: { prompt: 'slow-timeout', timeoutMs: 100 },
        },
      })) as {
        content: Array<{ text: string }>;
        isError?: boolean;
      };

      expect(timedOutResponse.isError).toBe(true);
      expect(timedOutResponse.content[0]?.text).toContain(
        'Tool call timed out after 100ms'
      );

      const secondResponse = (await sendTimeoutRequest({
        jsonrpc: JSONRPC_VERSION,
        id: 202,
        method: 'tools/call',
        params: { name: 'codex', arguments: { prompt: 'fast-after-timeout' } },
      })) as {
        content: Array<{ text: string }>;
      };

      expect(secondResponse.content[0]?.text).toBe('stub stdout\n');
      expect({ timeoutExitCode, timeoutExitSignal }).toEqual({
        timeoutExitCode: null,
        timeoutExitSignal: null,
      });
    } finally {
      if (
        timeoutServer &&
        timeoutExitCode === null &&
        timeoutExitSignal === null
      ) {
        timeoutServer.kill();
        await new Promise((resolve) => timeoutServer?.once('exit', resolve));
      }
      rmSync(timeoutStubDir, { recursive: true, force: true });
    }
  });

  test('unblocks queued calls after a review timeout', async () => {
    const distPath = path.join(process.cwd(), 'dist', 'index.js');
    await ensureBuild(distPath);

    const timeoutStubDir = createTimeoutCodexStub();
    let timeoutServer: ReturnType<typeof spawn> | null = null;
    let timeoutBuffer = '';
    let timeoutExitCode: number | null = null;
    let timeoutExitSignal: ExitSignal = null;
    const timeoutPending = new Map<number, (payload: unknown) => void>();

    const sendTimeoutRequest = (request: Record<string, unknown>) =>
      new Promise<unknown>((resolve, reject) => {
        if (!timeoutServer?.stdin) {
          reject(new Error('Review timeout test server stdin not available'));
          return;
        }

        const id = request.id as number;
        const timer = globalThis.setTimeout(() => {
          timeoutPending.delete(id);
          reject(new Error(`Timed out waiting for response ${id}`));
        }, TEST_TIMEOUT_MS);

        timeoutPending.set(id, (payload) => {
          globalThis.clearTimeout(timer);
          resolve(payload);
        });

        timeoutServer.stdin.write(`${JSON.stringify(request)}\n`);
      });

    try {
      timeoutServer = spawn(process.execPath, [distPath], {
        env: {
          ...process.env,
          PATH: `${timeoutStubDir}${path.delimiter}${process.env.PATH}`,
          CODEX_TOOL_TIMEOUT_MS: '100',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      timeoutServer.stdout?.setEncoding('utf8');
      timeoutServer.stdout?.on('data', (chunk: string) => {
        timeoutBuffer += chunk;
        let newlineIndex = timeoutBuffer.indexOf('\n');

        while (newlineIndex >= 0) {
          const line = timeoutBuffer.slice(0, newlineIndex).trim();
          timeoutBuffer = timeoutBuffer.slice(newlineIndex + 1);

          if (line) {
            try {
              const payload = JSON.parse(line) as {
                id?: number;
                result?: unknown;
              };

              if (typeof payload.id === 'number') {
                const resolver = timeoutPending.get(payload.id);
                if (resolver) {
                  resolver(payload.result ?? payload);
                  timeoutPending.delete(payload.id);
                }
              }
            } catch {
              // Ignore non-JSON output
            }
          }

          newlineIndex = timeoutBuffer.indexOf('\n');
        }
      });

      timeoutServer.stderr?.on('data', () => {});
      timeoutServer.on('exit', (code, signal) => {
        timeoutExitCode = code;
        timeoutExitSignal = signal;
      });

      await sendTimeoutRequest({
        jsonrpc: JSONRPC_VERSION,
        id: 300,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-review-timeout', version: '1' },
        },
      });

      timeoutServer.stdin?.write(
        `${JSON.stringify({
          jsonrpc: JSONRPC_VERSION,
          method: 'notifications/initialized',
          params: {},
        })}\n`
      );

      const timedOutResponse = (await sendTimeoutRequest({
        jsonrpc: JSONRPC_VERSION,
        id: 301,
        method: 'tools/call',
        params: {
          name: 'review',
          arguments: {
            base: 'main',
            prompt: 'slow-timeout',
          },
        },
      })) as {
        content: Array<{ text: string }>;
        isError?: boolean;
      };

      expect(timedOutResponse.isError).toBe(true);
      expect(timedOutResponse.content[0]?.text).toContain(
        'Tool call timed out after 100ms'
      );

      const pingStartedAt = Date.now();
      const pingResponse = (await sendTimeoutRequest({
        jsonrpc: JSONRPC_VERSION,
        id: 302,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: { message: 'after-review-timeout' },
        },
      })) as {
        content: Array<{ text: string }>;
      };

      expect(Date.now() - pingStartedAt).toBeLessThan(1000);
      expect(pingResponse.content[0]?.text).toBe('after-review-timeout');
      expect({ timeoutExitCode, timeoutExitSignal }).toEqual({
        timeoutExitCode: null,
        timeoutExitSignal: null,
      });
    } finally {
      if (
        timeoutServer &&
        timeoutExitCode === null &&
        timeoutExitSignal === null
      ) {
        timeoutServer.kill();
        await new Promise((resolve) => timeoutServer?.once('exit', resolve));
      }
      rmSync(timeoutStubDir, { recursive: true, force: true });
    }
  });
});
