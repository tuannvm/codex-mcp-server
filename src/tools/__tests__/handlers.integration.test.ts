// Ensure no real CLI calls happen in these integration-ish tests.
import { jest } from '@jest/globals';

const mockExecuteCommand = jest.fn();
const mockExecuteCommandStreamed = jest.fn();

await jest.unstable_mockModule('../../utils/command.js', () => ({
  __esModule: true,
  executeCommand: mockExecuteCommand,
  executeCommandStreamed: mockExecuteCommandStreamed,
}));

const {
  CodexToolHandler,
  ListSessionsToolHandler,
  PingToolHandler,
  HelpToolHandler,
} = await import('../handlers.js');

describe('CodexToolHandler (light integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecuteCommandStreamed.mockResolvedValue({ stdout: 'ok', stderr: '' });
  });

  it('should wrap validation failure as ToolExecutionError for missing prompt', async () => {
    const handler = new CodexToolHandler();
    await expect(handler.execute({})).rejects.toThrow(
      'Failed to execute codex command'
    );
    expect(mockExecuteCommandStreamed).not.toHaveBeenCalled();
  });

  it('should throw on invalid args', async () => {
    const handler = new CodexToolHandler();
    await expect(
      handler.execute({ pageSize: 'not-a-number' } as any)
    ).rejects.toThrow();
  });
});

describe('ListSessionsToolHandler', () => {
  it('should return no sessions if none exist', async () => {
    const handler = new ListSessionsToolHandler();
    const result = await handler.execute({});
    expect(result.content[0].text).toMatch(/No active sessions/);
  });
});

describe('PingToolHandler', () => {
  it('should return pong by default', async () => {
    const handler = new PingToolHandler();
    const result = await handler.execute({});
    expect(result.content[0].text).toBe('pong');
  });
});

describe('HelpToolHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use mocked help output', async () => {
    mockExecuteCommand.mockResolvedValue({ stdout: 'mocked help', stderr: '' });
    const handler = new HelpToolHandler();
    const result = await handler.execute({});
    expect(result.content[0].text).toContain('mocked help');
  });
});
