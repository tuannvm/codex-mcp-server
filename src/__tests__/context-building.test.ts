import type { CodexToolHandler as CodexToolHandlerType } from '../tools/handlers.js';
import { InMemorySessionStorage } from '../session/storage.js';

// Mock the command execution
jest.mock('../utils/command.js', () => ({
  executeCommand: jest.fn(),
}));

describe('Context Building Analysis', () => {
  let CodexToolHandler: typeof import('../tools/handlers.js').CodexToolHandler;
  let handler: CodexToolHandlerType;
  let mockedExecuteCommand: jest.MockedFunction<
    typeof import('../utils/command.js').executeCommand
  >;
  let sessionStorage: InMemorySessionStorage;
  let originalStructuredContent: string | undefined;

  beforeAll(() => {
    originalStructuredContent = process.env.STRUCTURED_CONTENT_ENABLED;
  });

  afterAll(() => {
    if (originalStructuredContent) {
      process.env.STRUCTURED_CONTENT_ENABLED = originalStructuredContent;
    } else {
      delete process.env.STRUCTURED_CONTENT_ENABLED;
    }
  });

  beforeEach(async () => {
    jest.resetModules();
    process.env.STRUCTURED_CONTENT_ENABLED = '1';
    ({ CodexToolHandler } = await import('../tools/handlers.js'));
    const commandModule = await import('../utils/command.js');
    mockedExecuteCommand = commandModule.executeCommand as jest.MockedFunction<
      typeof commandModule.executeCommand
    >;
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
    const sentPrompt = call?.[1]?.[4]; // After exec, --model, gpt-5.4, --skip-git-repo-check, prompt
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

    expect(result.content[0].text).toBe('Test response'); // No session noise
  });

  test('should include session ID in metadata when using sessions', async () => {
    const sessionId = sessionStorage.createSession();
    const result = await handler.execute({ prompt: 'Test prompt', sessionId });

    expect(result.content[0]._meta?.sessionId).toBe(sessionId);
    expect(result.structuredContent?.sessionId).toBe(sessionId);
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
