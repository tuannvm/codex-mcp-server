// Mock chalk to avoid ESM issues in Jest
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    blue: (text: string) => text,
    yellow: (text: string) => text,
    green: (text: string) => text,
    red: (text: string) => text,
  },
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

import { EventEmitter } from 'events';
import { Buffer } from 'node:buffer';

import { executeCommand } from '../utils/command.js';
import { COMMAND_LOG_ENV_VAR } from '../runtime-config.js';
import { spawn } from 'child_process';

type MockedSpawn = jest.MockedFunction<typeof spawn>;
type MockChild = ReturnType<typeof spawn> &
  EventEmitter & {
    stderr: EventEmitter;
    stdout: EventEmitter;
  };

function createMockChild() {
  const child = new EventEmitter() as unknown as MockChild;

  Object.assign(child, {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: { end: jest.fn() } as unknown as ReturnType<typeof spawn>['stdin'],
    kill: jest.fn(),
  });
  Object.defineProperty(child, 'pid', { value: 12345 });

  return child;
}

describe('command logging', () => {
  const mockedSpawn = spawn as MockedSpawn;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockedSpawn.mockReset();
    Reflect.deleteProperty(process.env, COMMAND_LOG_ENV_VAR);
  });

  test('does not log command execution details by default', async () => {
    const child = createMockChild();
    mockedSpawn.mockReturnValue(child);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const commandPromise = executeCommand('codex', ['exec', 'test prompt']);

    child.stderr.emit('data', Buffer.from('stderr output'));
    child.emit('close', 0);

    await expect(commandPromise).resolves.toEqual({
      stdout: '',
      stderr: 'stderr output',
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('logs command execution details when explicitly enabled', async () => {
    process.env[COMMAND_LOG_ENV_VAR] = '1';

    const child = createMockChild();
    mockedSpawn.mockReturnValue(child);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const commandPromise = executeCommand('codex', ['exec', 'test prompt']);

    child.stderr.emit('data', Buffer.from('stderr output'));
    child.emit('close', 0);

    await expect(commandPromise).resolves.toEqual({
      stdout: '',
      stderr: 'stderr output',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Executing:',
      'codex',
      'exec test prompt'
    );
    expect(errorSpy).toHaveBeenCalledWith('Command stderr:', 'stderr output');
  });
});
