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

import { Server } from '@modelcontextprotocol/sdk/server/index.js';

import { CodexMcpServer } from '../server.js';
import { STARTUP_LOG_ENV_VAR } from '../runtime-config.js';

describe('startup logging', () => {
  beforeEach(() => {
    Reflect.deleteProperty(process.env, STARTUP_LOG_ENV_VAR);
    jest.restoreAllMocks();
  });

  test('does not log startup to stderr by default', async () => {
    const connectSpy = jest
      .spyOn(Server.prototype, 'connect')
      .mockResolvedValue(undefined as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const server = new CodexMcpServer({
      name: 'test-server',
      version: '1.0.0',
    });

    await server.start();

    expect(connectSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('logs startup when explicitly enabled', async () => {
    process.env[STARTUP_LOG_ENV_VAR] = '1';

    const connectSpy = jest
      .spyOn(Server.prototype, 'connect')
      .mockResolvedValue(undefined as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const server = new CodexMcpServer({
      name: 'test-server',
      version: '1.0.0',
    });

    await server.start();

    expect(connectSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('test-server started successfully');
  });
});
