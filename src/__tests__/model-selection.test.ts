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

describe('Model Selection and Reasoning Effort', () => {
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
  });

  test('should pass model parameter to codex CLI', async () => {
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

  test('should pass reasoning effort to codex CLI', async () => {
    await handler.execute({
      prompt: 'Complex analysis',
      reasoningEffort: 'high',
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5.2-codex',
      '-c',
      'model_reasoning_effort="high"',
      '--skip-git-repo-check',
      'Complex analysis',
    ]);
  });

  test('should pass xhigh reasoning effort to codex CLI', async () => {
    await handler.execute({
      prompt: 'Deep analysis',
      reasoningEffort: 'xhigh',
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5.2-codex',
      '-c',
      'model_reasoning_effort="xhigh"',
      '--skip-git-repo-check',
      'Deep analysis',
    ]);
  });

  test('should combine model and reasoning effort', async () => {
    await handler.execute({
      prompt: 'Advanced task',
      model: 'gpt-4',
      reasoningEffort: 'medium',
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-4',
      '-c',
      'model_reasoning_effort="medium"',
      '--skip-git-repo-check',
      'Advanced task',
    ]);
  });

  test('should reject xhigh for unsupported models', async () => {
    await expect(
      handler.execute({
        prompt: 'Unsupported effort',
        model: 'gpt-4',
        reasoningEffort: 'xhigh',
      })
    ).rejects.toThrow('xhigh');

    expect(mockedExecuteCommand).not.toHaveBeenCalled();
  });

  test('should allow xhigh for supported models', async () => {
    await handler.execute({
      prompt: 'Supported effort',
      model: 'gpt-5.2',
      reasoningEffort: 'xhigh',
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5.2',
      '-c',
      'model_reasoning_effort="xhigh"',
      '--skip-git-repo-check',
      'Supported effort',
    ]);
  });

  test('should include model info in response metadata', async () => {
    const result = await handler.execute({
      prompt: 'Test prompt',
      model: 'gpt-3.5-turbo',
      reasoningEffort: 'low',
    });

    expect(result._meta).toEqual({
      model: 'gpt-3.5-turbo',
    });
  });

  test('should work with sessions and model selection', async () => {
    const sessionId = sessionStorage.createSession();

    const result = await handler.execute({
      prompt: 'Session test',
      sessionId,
      model: 'gpt-4',
    });

    expect(result._meta).toEqual({
      sessionId,
      model: 'gpt-4',
    });
  });

  test('should validate reasoning effort enum', async () => {
    await expect(
      handler.execute({
        prompt: 'Test',
        reasoningEffort: 'invalid' as 'low',
      })
    ).rejects.toThrow();
  });

  test('should allow xhigh in resume mode', async () => {
    const sessionId = sessionStorage.createSession();
    sessionStorage.setCodexConversationId(sessionId, 'existing-conv-id');

    await handler.execute({
      prompt: 'Resume with xhigh',
      sessionId,
      reasoningEffort: 'xhigh',
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--skip-git-repo-check',
      '-c',
      'model="gpt-5.2-codex"',
      '-c',
      'model_reasoning_effort="xhigh"',
      'resume',
      'existing-conv-id',
      'Resume with xhigh',
    ]);
  });

  test('should pass minimal reasoning effort to CLI', async () => {
    await handler.execute({
      prompt: 'Quick task',
      reasoningEffort: 'minimal',
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5.2-codex',
      '-c',
      'model_reasoning_effort="minimal"',
      '--skip-git-repo-check',
      'Quick task',
    ]);
  });
});
