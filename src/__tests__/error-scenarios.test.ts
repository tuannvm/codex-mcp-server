import { CodexToolHandler } from '../tools/handlers.js';
import { InMemorySessionStorage } from '../session/storage.js';
import { executeCommand } from '../utils/command.js';
import { ToolExecutionError } from '../errors.js';

// Mock the command execution
jest.mock('../utils/command.js', () => ({
  executeCommand: jest.fn(),
}));

const mockedExecuteCommand = executeCommand as jest.MockedFunction<
  typeof executeCommand
>;

describe('Error Handling Scenarios', () => {
  let handler: CodexToolHandler;
  let sessionStorage: InMemorySessionStorage;

  beforeEach(() => {
    sessionStorage = new InMemorySessionStorage();
    handler = new CodexToolHandler(sessionStorage);
    mockedExecuteCommand.mockClear();
  });

  test('should handle codex CLI authentication errors', async () => {
    mockedExecuteCommand.mockRejectedValue(
      new Error('Authentication failed: Please run `codex login`')
    );

    await expect(handler.execute({ prompt: 'Test prompt' })).rejects.toThrow(
      ToolExecutionError
    );
  });

  test('should handle codex CLI not found errors', async () => {
    mockedExecuteCommand.mockRejectedValue(
      new Error('command not found: codex')
    );

    await expect(handler.execute({ prompt: 'Test prompt' })).rejects.toThrow(
      ToolExecutionError
    );
  });

  test('should handle invalid model parameters', async () => {
    mockedExecuteCommand.mockRejectedValue(
      new Error('Invalid model: invalid-model')
    );

    await expect(
      handler.execute({
        prompt: 'Test prompt',
        model: 'invalid-model',
      })
    ).rejects.toThrow(ToolExecutionError);
  });

  test('should handle codex CLI timeout errors', async () => {
    mockedExecuteCommand.mockRejectedValue(
      new Error('Timeout: Command took too long to execute')
    );

    await expect(
      handler.execute({ prompt: 'Complex analysis task' })
    ).rejects.toThrow(ToolExecutionError);
  });

  test('should handle network errors during codex execution', async () => {
    mockedExecuteCommand.mockRejectedValue(
      new Error('Network error: Unable to reach OpenAI API')
    );

    await expect(handler.execute({ prompt: 'Test prompt' })).rejects.toThrow(
      ToolExecutionError
    );
  });

  test('should handle invalid session IDs gracefully', async () => {
    // Non-existent session ID should not crash
    mockedExecuteCommand.mockResolvedValue({ stdout: 'Response', stderr: '' });

    const result = await handler.execute({
      prompt: 'Test prompt',
      sessionId: 'non-existent-session-id',
    });

    expect(result.content[0].text).toBe('Response');
  });

  test('should handle corrupted session data', async () => {
    const sessionId = sessionStorage.createSession();

    // Manually corrupt session data
    const session = sessionStorage.getSession(sessionId);
    if (session) {
      (session.turns as unknown) = null; // Corrupt the turns array
    }

    mockedExecuteCommand.mockResolvedValue({ stdout: 'Response', stderr: '' });

    // Should not crash, should handle gracefully
    const result = await handler.execute({
      prompt: 'Test prompt',
      sessionId,
    });

    expect(result.content[0].text).toBe('Response');
  });

  test('should handle malformed resume conversation IDs', async () => {
    const sessionId = sessionStorage.createSession();
    sessionStorage.setCodexConversationId(sessionId, 'invalid-conv-id-format');

    mockedExecuteCommand.mockRejectedValue(
      new Error('Invalid conversation ID format')
    );

    await expect(
      handler.execute({
        prompt: 'Resume test',
        sessionId,
      })
    ).rejects.toThrow(ToolExecutionError);
  });

  test('should handle very long prompts', async () => {
    const longPrompt = 'A'.repeat(100000); // 100k character prompt

    mockedExecuteCommand.mockResolvedValue({ stdout: 'Response', stderr: '' });

    const result = await handler.execute({ prompt: longPrompt });

    expect(result.content[0].text).toBe('Response');
    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5.1-codex',
      '--skip-git-repo-check',
      longPrompt,
    ]);
  });
});
