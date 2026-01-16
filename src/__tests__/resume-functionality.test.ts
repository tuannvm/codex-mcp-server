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

describe('Codex Resume Functionality', () => {
  let handler: CodexToolHandler;
  let sessionStorage: InMemorySessionStorage;

  beforeEach(() => {
    sessionStorage = new InMemorySessionStorage();
    handler = new CodexToolHandler(sessionStorage);
    mockedExecuteCommand.mockClear();
    delete process.env.CODEX_MCP_CALLBACK_URI;
  });

  test('should use exec for new session without codex session ID', async () => {
    const sessionId = sessionStorage.createSession();
    mockedExecuteCommand.mockResolvedValue({
      stdout: 'Test response',
      stderr: 'session id: abc-123-def',
    });

    await handler.execute({
      prompt: 'First message',
      sessionId,
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5.2-codex',
      '--skip-git-repo-check',
      'First message',
    ]);
  });

  test('should extract and store session ID', async () => {
    const sessionId = sessionStorage.createSession();
    mockedExecuteCommand.mockResolvedValue({
      stdout: 'Test response',
      stderr: 'session id: abc-123-def',
    });

    await handler.execute({
      prompt: 'First message',
      sessionId,
    });

    expect(sessionStorage.getCodexConversationId(sessionId)).toBe(
      'abc-123-def'
    );
  });

  test('should surface threadId in response metadata when present', async () => {
    mockedExecuteCommand.mockResolvedValue({
      stdout: 'thread id: th_123',
      stderr: '',
    });

    const result = await handler.execute({
      prompt: 'Thread metadata check',
    });

    expect(result._meta?.threadId).toBe('th_123');
  });

  test('should pass callback URI via environment when provided', async () => {
    mockedExecuteCommand.mockResolvedValue({
      stdout: 'Test response',
      stderr: '',
    });

    await handler.execute({
      prompt: 'Callback check',
      callbackUri: 'http://localhost:1234/callback',
    });

    expect(mockedExecuteCommand).toHaveBeenCalledWith(
      'codex',
      expect.any(Array),
      { CODEX_MCP_CALLBACK_URI: 'http://localhost:1234/callback' }
    );
  });

  test('should use resume for subsequent messages in session', async () => {
    const sessionId = sessionStorage.createSession();
    sessionStorage.setCodexConversationId(
      sessionId,
      'existing-codex-session-id'
    );

    mockedExecuteCommand.mockResolvedValue({
      stdout: 'Resumed response',
      stderr: '',
    });

    await handler.execute({
      prompt: 'Continue the task',
      sessionId,
    });

    // Resume mode: all exec options must come BEFORE 'resume' subcommand
    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--skip-git-repo-check',
      '-c',
      'model="gpt-5.2-codex"',
      'resume',
      'existing-codex-session-id',
      'Continue the task',
    ]);
  });

  test('should reset session ID when session is reset', async () => {
    const sessionId = sessionStorage.createSession();
    sessionStorage.setCodexConversationId(sessionId, 'old-session-id');

    mockedExecuteCommand.mockResolvedValue({
      stdout: 'Test response',
      stderr: 'session id: new-session-id',
    });

    await handler.execute({
      prompt: 'Reset and start new',
      sessionId,
      resetSession: true,
    });

    // Should use exec (not resume) and get new session ID
    expect(mockedExecuteCommand).toHaveBeenCalledWith('codex', [
      'exec',
      '--model',
      'gpt-5.2-codex',
      '--skip-git-repo-check',
      'Reset and start new',
    ]);
    expect(sessionStorage.getCodexConversationId(sessionId)).toBe(
      'new-session-id'
    );
  });

  test('should fall back to manual context if no codex session ID', async () => {
    const sessionId = sessionStorage.createSession();

    // Add some history
    sessionStorage.addTurn(sessionId, {
      prompt: 'Previous question',
      response: 'Previous answer',
      timestamp: new Date(),
    });

    mockedExecuteCommand.mockResolvedValue({
      stdout: 'Context-aware response',
      stderr: '',
    });

    await handler.execute({
      prompt: 'Follow up question',
      sessionId,
    });

    // Should build enhanced prompt since no codex session ID
    const call = mockedExecuteCommand.mock.calls[0];
    const sentPrompt = call?.[1]?.[4]; // After exec, --model, gpt-5.2-codex, --skip-git-repo-check, prompt
    expect(sentPrompt).toContain('Context:');
    expect(sentPrompt).toContain('Task: Follow up question');
  });
});
