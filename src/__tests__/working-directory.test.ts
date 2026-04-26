import {
  CodexToolHandler,
  HelpToolHandler,
  ReviewToolHandler,
  WebSearchToolHandler,
} from '../tools/handlers.js';
import { InMemorySessionStorage } from '../session/storage.js';
import { executeCommand, executeCommandStreaming } from '../utils/command.js';

// Mock the command execution
jest.mock('../utils/command.js', () => ({
  executeCommand: jest.fn(),
  executeCommandStreaming: jest.fn(),
}));

const mockedExecuteCommand = executeCommand as jest.MockedFunction<
  typeof executeCommand
>;
const mockedExecuteCommandStreaming =
  executeCommandStreaming as jest.MockedFunction<
    typeof executeCommandStreaming
  >;

describe('Working Directory (cwd) Support', () => {
  let codexHandler: CodexToolHandler;
  let helpHandler: HelpToolHandler;
  let reviewHandler: ReviewToolHandler;
  let sessionStorage: InMemorySessionStorage;
  let webSearchHandler: WebSearchToolHandler;

  beforeEach(() => {
    sessionStorage = new InMemorySessionStorage();
    codexHandler = new CodexToolHandler(sessionStorage);
    helpHandler = new HelpToolHandler();
    reviewHandler = new ReviewToolHandler();
    webSearchHandler = new WebSearchToolHandler();
    mockedExecuteCommand.mockClear();
    mockedExecuteCommandStreaming.mockClear();
    mockedExecuteCommand.mockResolvedValue({
      stdout: 'Response',
      stderr: '',
    });
    mockedExecuteCommandStreaming.mockResolvedValue({
      stdout: 'Response',
      stderr: '',
    });
  });

  describe('ReviewToolHandler', () => {
    test('should pass cwd when workingDirectory is provided', async () => {
      await reviewHandler.execute({
        uncommitted: true,
        workingDirectory: '/path/to/worktree',
      });

      // Should pass -C flag in args AND cwd in options
      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining([
          '-C',
          '/path/to/worktree',
          'review',
          '--uncommitted',
        ]),
        expect.objectContaining({ cwd: '/path/to/worktree' })
      );
    });

    test('should pass undefined cwd when workingDirectory is omitted', async () => {
      await reviewHandler.execute({
        uncommitted: true,
      });

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['review', '--uncommitted']),
        expect.objectContaining({ cwd: undefined })
      );
    });

    test('should pass cwd to streaming execution', async () => {
      const controller = new AbortController();

      await reviewHandler.execute(
        {
          uncommitted: true,
          workingDirectory: '/path/to/worktree',
        },
        {
          abortSignal: controller.signal,
          sendProgress: async () => {},
          progressToken: 'test-token',
        }
      );

      expect(mockedExecuteCommandStreaming).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['-C', '/path/to/worktree']),
        expect.objectContaining({
          cwd: '/path/to/worktree',
          signal: controller.signal,
        })
      );
    });
  });

  describe('CodexToolHandler', () => {
    test('should pass cwd when workingDirectory is provided', async () => {
      await codexHandler.execute({
        prompt: 'Test prompt',
        workingDirectory: '/path/to/worktree',
      });

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['-C', '/path/to/worktree']),
        expect.objectContaining({ cwd: '/path/to/worktree' })
      );
    });

    test('should pass undefined cwd when workingDirectory is omitted', async () => {
      await codexHandler.execute({
        prompt: 'Test prompt',
      });

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['exec', 'Test prompt']),
        expect.objectContaining({ cwd: undefined })
      );
    });

    test('should pass bypassApprovals flag when starting a new execution', async () => {
      await codexHandler.execute({
        prompt: 'Test prompt',
        bypassApprovals: true,
      });

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['--dangerously-bypass-approvals-and-sandbox']),
        expect.any(Object)
      );
    });

    test('should not apply cwd when resuming a session', async () => {
      const sessionId = sessionStorage.createSession();
      sessionStorage.setCodexConversationId(sessionId, 'conv-123');

      await codexHandler.execute({
        prompt: 'Continue task',
        sessionId,
        workingDirectory: '/path/to/worktree',
      });

      // Resume mode should omit cwd (Codex CLI limitation)
      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['resume', 'conv-123', 'Continue task']),
        expect.objectContaining({ cwd: undefined })
      );
      // -C should also be absent from resume args
      const args = mockedExecuteCommand.mock.calls[0][1];
      expect(args).not.toContain('-C');
    });

    test('should pass bypassApprovals flag when resuming a session', async () => {
      const sessionId = sessionStorage.createSession();
      sessionStorage.setCodexConversationId(sessionId, 'conv-123');

      await codexHandler.execute({
        prompt: 'Continue task',
        sessionId,
        bypassApprovals: true,
      });

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining([
          '--dangerously-bypass-approvals-and-sandbox',
          'resume',
          'conv-123',
          'Continue task',
        ]),
        expect.any(Object)
      );
    });

    test('should pass fullAuto flag when resuming a session', async () => {
      const sessionId = sessionStorage.createSession();
      sessionStorage.setCodexConversationId(sessionId, 'conv-123');

      await codexHandler.execute({
        prompt: 'Continue task',
        sessionId,
        fullAuto: true,
      });

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining([
          '--full-auto',
          'resume',
          'conv-123',
          'Continue task',
        ]),
        expect.any(Object)
      );
    });
  });

  describe('HelpToolHandler', () => {
    test('should pass abortSignal to command execution', async () => {
      const controller = new AbortController();

      await helpHandler.execute(
        {},
        {
          abortSignal: controller.signal,
          sendProgress: async () => {},
        }
      );

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        ['--help'],
        expect.objectContaining({ signal: controller.signal })
      );
    });
  });

  describe('WebSearchToolHandler', () => {
    test('should pass abortSignal to command execution', async () => {
      const controller = new AbortController();

      await webSearchHandler.execute(
        { query: 'timeout regression' },
        {
          abortSignal: controller.signal,
          sendProgress: async () => {},
        }
      );

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['--search', 'exec']),
        expect.objectContaining({ signal: controller.signal })
      );
    });
  });
});
