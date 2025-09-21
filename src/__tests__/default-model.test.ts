import { CodexToolHandler } from '../tools/handlers.js';
import { InMemorySessionStorage } from '../session/storage.js';
import { executeCommand } from '../utils/command.js';

// Mock the command execution
jest.mock('../utils/command.js', () => ({
  executeCommand: jest.fn(),
}));

const mockedExecuteCommand = executeCommand as jest.MockedFunction<typeof executeCommand>;

describe('Default Model Configuration', () => {
  let handler: CodexToolHandler;
  let sessionStorage: InMemorySessionStorage;

  beforeEach(() => {
    sessionStorage = new InMemorySessionStorage();
    handler = new CodexToolHandler(sessionStorage);
    mockedExecuteCommand.mockClear();
    mockedExecuteCommand.mockResolvedValue({ stdout: 'Test response', stderr: '' });
  });

  test('should use gpt-5-codex as default model when no model specified', async () => {
    await handler.execute({ prompt: 'Test prompt' });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5-codex',
      'Test prompt',
    ]);
  });

  test('should include default model in response metadata', async () => {
    const result = await handler.execute({ prompt: 'Test prompt' });

    expect(result._meta?.model).toBe('gpt-5-codex');
  });

  test('should override default model when explicit model provided', async () => {
    await handler.execute({
      prompt: 'Test prompt',
      model: 'gpt-4',
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-4',
      'Test prompt',
    ]);
  });

  test('should use default model with sessions', async () => {
    const sessionId = sessionStorage.createSession();

    await handler.execute({
      prompt: 'Test prompt',
      sessionId,
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5-codex',
      'Test prompt',
    ]);
  });

  test('should use default model with resume functionality', async () => {
    const sessionId = sessionStorage.createSession();
    sessionStorage.setCodexConversationId(sessionId, 'existing-conv-id');

    await handler.execute({
      prompt: 'Resume with default model',
      sessionId,
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'resume',
      'existing-conv-id',
      '--model',
      'gpt-5-codex',
      'Resume with default model',
    ]);
  });

  test('should combine default model with reasoning effort', async () => {
    await handler.execute({
      prompt: 'Complex task',
      reasoningEffort: 'high',
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5-codex',
      '--reasoning-effort',
      'high',
      'Complex task',
    ]);
  });
});
