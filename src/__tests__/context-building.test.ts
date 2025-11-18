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

describe('Context Building Analysis', () => {
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

  test('should build enhanced prompt correctly', async () => {
    const sessionId = sessionStorage.createSession();

    // Add some conversation history
    sessionStorage.addTurn(sessionId, {
      prompt: 'What is recursion?',
      response:
        'Recursion is a programming technique where a function calls itself.',
      timestamp: new Date(),
    });

    sessionStorage.addTurn(sessionId, {
      prompt: 'Show me an example',
      response: 'def factorial(n): return 1 if n <= 1 else n * factorial(n-1)',
      timestamp: new Date(),
    });

    // Execute with context
    await handler.execute({ prompt: 'Make it more efficient', sessionId });

    // Check what prompt was sent to Codex - should be enhanced but not conversational
    const call = mockedExecuteCommand.mock.calls[0];
    const sentPrompt = call?.[1]?.[4]; // After exec, --model, gpt-5.1-codex, --skip-git-repo-check, prompt
    expect(sentPrompt).toContain('Previous code context:');
    expect(sentPrompt).toContain('Task: Make it more efficient');
    expect(sentPrompt).not.toContain('Previous: What is recursion?'); // No conversational format
  });

  test('should not automatically create sessions', async () => {
    const initialSessions = sessionStorage.listSessions().length;

    await handler.execute({ prompt: 'Simple test' });

    const newSessions = sessionStorage.listSessions().length;
    expect(newSessions).toBe(initialSessions); // No automatic session creation
  });

  test('should work without sessions by default', async () => {
    const result = await handler.execute({ prompt: 'Simple test' });

    expect(result._meta?.sessionId).toBeUndefined();
    expect(result.content[0].text).toBe('Test response'); // No session noise
  });

  test('should include session ID in metadata when using sessions', async () => {
    const sessionId = sessionStorage.createSession();
    const result = await handler.execute({ prompt: 'Test prompt', sessionId });

    expect(result._meta?.sessionId).toBe(sessionId);
    expect(result.content[0].text).toBe('Test response'); // Clean response
  });

  test('should not save turn on command failure', async () => {
    mockedExecuteCommand.mockRejectedValue(new Error('Command failed'));

    const sessionId = sessionStorage.createSession();
    const initialTurns =
      sessionStorage.getSession(sessionId)?.turns.length || 0;

    try {
      await handler.execute({ prompt: 'Test prompt', sessionId });
    } catch {
      // Expected to fail
    }

    // Turn should not be saved if command failed
    const finalTurns = sessionStorage.getSession(sessionId)?.turns.length || 0;
    expect(finalTurns).toBe(initialTurns);
  });
});
