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

describe('Edge Cases and Integration Issues', () => {
  let handler: CodexToolHandler;
  let sessionStorage: InMemorySessionStorage;

  beforeEach(() => {
    sessionStorage = new InMemorySessionStorage();
    handler = new CodexToolHandler(sessionStorage);
    mockedExecuteCommand.mockClear();
  });

  test('should handle model parameters with resume', async () => {
    const sessionId = sessionStorage.createSession();
    sessionStorage.setCodexConversationId(sessionId, 'existing-conv-id');

    mockedExecuteCommand.mockResolvedValue({ stdout: 'Response', stderr: '' });

    // User wants to change model in existing session
    await handler.execute({
      prompt: 'Use different model',
      sessionId,
      model: 'gpt-4',
      reasoningEffort: 'high',
    });

    const call = mockedExecuteCommand.mock.calls[0];
    expect(call[1]).toEqual([
      'resume',
      'existing-conv-id',
      '--model',
      'gpt-4',
      '-c',
      'model_reasoning_effort=high',
      '--skip-git-repo-check',
      'Use different model',
    ]);
  });

  test('should handle missing conversation ID gracefully', async () => {
    mockedExecuteCommand.mockResolvedValue({
      stdout: 'Response without conversation ID',
      stderr: 'Some other output', // No conversation ID pattern
    });

    const sessionId = sessionStorage.createSession();
    await handler.execute({
      prompt: 'Test prompt',
      sessionId,
    });

    // Should not crash, conversation ID should be undefined
    expect(sessionStorage.getCodexConversationId(sessionId)).toBeUndefined();
  });

  test('should handle various conversation ID formats', async () => {
    const testCases = [
      'Conversation ID: abc-123-def',
      'conversation id: XYZ789',
      'ConversationID:uuid-format-here',
      'Conversation ID:  spaced-format  ',
    ];

    for (const [index, stderr] of testCases.entries()) {
      const sessionId = sessionStorage.createSession();
      mockedExecuteCommand.mockResolvedValue({ stdout: 'Response', stderr });

      await handler.execute({
        prompt: `Test ${index}`,
        sessionId,
      });

      const conversationId = sessionStorage.getCodexConversationId(sessionId);
      expect(conversationId).toBeDefined();
      expect(conversationId).not.toContain('Conversation');
      expect(conversationId).not.toContain(':');
    }
  });

  test('should handle command execution failures', async () => {
    mockedExecuteCommand.mockRejectedValue(new Error('Codex CLI not found'));

    await expect(handler.execute({ prompt: 'Test prompt' })).rejects.toThrow(
      'Failed to execute codex command'
    );
  });

  test('should handle empty/malformed CLI responses', async () => {
    mockedExecuteCommand.mockResolvedValue({ stdout: '', stderr: '' });

    const result = await handler.execute({ prompt: 'Test prompt' });

    expect(result.content[0].text).toBe('No output from Codex');
  });

  test('should validate prompt parameter exists', async () => {
    await expect(
      handler.execute({}) // Missing required prompt
    ).rejects.toThrow();
  });

  test('should handle long conversation contexts', async () => {
    const sessionId = sessionStorage.createSession();

    // Add many turns to test context building
    for (let i = 0; i < 10; i++) {
      sessionStorage.addTurn(sessionId, {
        prompt: `Question ${i}`,
        response: `Answer ${i}`.repeat(100), // Long responses
        timestamp: new Date(),
      });
    }

    mockedExecuteCommand.mockResolvedValue({ stdout: 'Response', stderr: '' });

    await handler.execute({
      prompt: 'Final question',
      sessionId,
    });

    // Should only use recent turns, not crash with too much context
    const call = mockedExecuteCommand.mock.calls[0];
    const prompt = call?.[1]?.[4]; // After exec, --model, gpt-5.1-codex, --skip-git-repo-check, prompt
    expect(typeof prompt).toBe('string');
    if (prompt) {
      expect(prompt.length).toBeLessThan(5000); // Reasonable limit
    }
  });
});
