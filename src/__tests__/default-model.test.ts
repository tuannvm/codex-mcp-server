import { CodexToolHandler } from '../tools/handlers.js';
import { InMemorySessionStorage } from '../session/storage.js';
import { executeCommand } from '../utils/command.js';

// Mock the command execution
jest.mock('../utils/command.js', () => ({
  executeCommand: jest.fn(),
}));

const mockedExecuteCommand = executeCommand as jest.MockedFunction<
  typeof executeCommand
>;

describe('Default Model Configuration', () => {
  let handler: CodexToolHandler;
  let sessionStorage: InMemorySessionStorage;

  beforeEach(() => {
    sessionStorage = new InMemorySessionStorage();
    handler = new CodexToolHandler(sessionStorage);
    mockedExecuteCommand.mockClear();
    mockedExecuteCommand.mockResolvedValue({
      stdout: 'Test response',
      stderr: '',
    });
    delete process.env.CODEX_MCP_CALLBACK_URI;
  });

  test('should use gpt-5.2-codex as default model when no model specified', async () => {
    await handler.execute({ prompt: 'Test prompt' });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5.2-codex',
      '--skip-git-repo-check',
      'Test prompt',
    ]);
  });

  test('should include default model in response metadata', async () => {
    const result = await handler.execute({ prompt: 'Test prompt' });

    expect(result.content[0]._meta?.model).toBe('gpt-5.2-codex');
    expect(result.structuredContent?.model).toBe('gpt-5.2-codex');
    expect(result._meta?.callbackUri).toBeUndefined();
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
      '--skip-git-repo-check',
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
      'gpt-5.2-codex',
      '--skip-git-repo-check',
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

    // Resume mode: all exec options must come BEFORE 'resume' subcommand
    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--skip-git-repo-check',
      '-c',
      'model="gpt-5.2-codex"',
      'resume',
      'existing-conv-id',
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
      'gpt-5.2-codex',
      '-c',
      'model_reasoning_effort="high"',
      '--skip-git-repo-check',
      'Complex task',
    ]);
  });

  test('should use CODEX_DEFAULT_MODEL environment variable when set', async () => {
    const originalEnv = process.env.CODEX_DEFAULT_MODEL;
    process.env.CODEX_DEFAULT_MODEL = 'gpt-4';

    try {
      await handler.execute({ prompt: 'Test with env var' });

      expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
        'exec',
        '--model',
        'gpt-4',
        '--skip-git-repo-check',
        'Test with env var',
      ]);
    } finally {
      if (originalEnv) {
        process.env.CODEX_DEFAULT_MODEL = originalEnv;
      } else {
        delete process.env.CODEX_DEFAULT_MODEL;
      }
    }
  });

  test('should prioritize explicit model over environment variable', async () => {
    const originalEnv = process.env.CODEX_DEFAULT_MODEL;
    process.env.CODEX_DEFAULT_MODEL = 'gpt-4';

    try {
      await handler.execute({
        prompt: 'Test priority',
        model: 'gpt-3.5-turbo',
      });

      expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
        'exec',
        '--model',
        'gpt-3.5-turbo',
        '--skip-git-repo-check',
        'Test priority',
      ]);
    } finally {
      if (originalEnv) {
        process.env.CODEX_DEFAULT_MODEL = originalEnv;
      } else {
        delete process.env.CODEX_DEFAULT_MODEL;
      }
    }
  });
});
