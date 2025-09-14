jest.setTimeout(20000);

import { jest } from '@jest/globals';

// ---------- Create mock fns FIRST (referenced by factory functions) ----------
const mockExecuteCommandStreamed = jest.fn();
const mockExecuteCommand = jest.fn();

const mockStripEchoesAndMarkers = jest.fn();
const mockMakeRunId = jest.fn();
const mockBuildPromptWithSentinels = jest.fn();

const mockSaveChunk = jest.fn();
const mockPeekChunk = jest.fn();
const mockAdvanceChunk = jest.fn();

const mockAppendTurn = jest.fn();
const mockGetTranscript = jest.fn();
const mockClearSession = jest.fn();
const mockListSessionIds = jest.fn();

// ---------- ESM-friendly module mocks (must run BEFORE importing SUT) ----------
await jest.unstable_mockModule('../../utils/command.js', () => ({
  __esModule: true,
  executeCommandStreamed: mockExecuteCommandStreamed,
  executeCommand: mockExecuteCommand,
}));

await jest.unstable_mockModule('../../utils/promptSanitizer.js', () => ({
  __esModule: true,
  stripEchoesAndMarkers: mockStripEchoesAndMarkers,
  makeRunId: mockMakeRunId,
  buildPromptWithSentinels: mockBuildPromptWithSentinels,
}));

await jest.unstable_mockModule('../../utils/cursorStore.js', () => ({
  __esModule: true,
  saveChunk: mockSaveChunk,
  peekChunk: mockPeekChunk,
  advanceChunk: mockAdvanceChunk,
}));

await jest.unstable_mockModule('../../utils/sessionStore.js', () => ({
  __esModule: true,
  appendTurn: mockAppendTurn,
  getTranscript: mockGetTranscript,
  clearSession: mockClearSession,
  listSessionIds: mockListSessionIds,
}));

// ---------- Now import SUT (after mocks are in place) ----------
const handlers = await import('../handlers.js');
const { TOOLS } = await import('../../types.js');
const command = await import('../../utils/command.js');

describe('Tool Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // sensible defaults so nothing hits real world
    mockExecuteCommandStreamed.mockResolvedValue({
      stdout: 'streamed out',
      stderr: '',
    });
    mockExecuteCommand.mockResolvedValue({ stdout: 'help info', stderr: '' });

    mockStripEchoesAndMarkers.mockImplementation(
      (_runId, _stitched, raw) => raw
    );
    mockMakeRunId.mockReturnValue('runid');
    mockBuildPromptWithSentinels.mockReturnValue('prompt');

    mockSaveChunk.mockReturnValue('token123');
    mockPeekChunk.mockReturnValue(undefined);
    mockAdvanceChunk.mockImplementation(() => {});

    mockAppendTurn.mockImplementation(() => {});
    mockGetTranscript.mockReturnValue([]);
    mockClearSession.mockImplementation(() => {});
    mockListSessionIds.mockReturnValue([]); // default: no sessions
  });

  it('should have handler classes', () => {
    expect(typeof handlers.CodexToolHandler).toBe('function');
    expect(typeof handlers.PingToolHandler).toBe('function');
    expect(typeof handlers.HelpToolHandler).toBe('function');
    expect(typeof handlers.ListSessionsToolHandler).toBe('function');
  });

  it('should instantiate handlers', () => {
    expect(new handlers.CodexToolHandler()).toBeInstanceOf(
      handlers.CodexToolHandler
    );
    expect(new handlers.PingToolHandler()).toBeInstanceOf(
      handlers.PingToolHandler
    );
    expect(new handlers.HelpToolHandler()).toBeInstanceOf(
      handlers.HelpToolHandler
    );
    expect(new handlers.ListSessionsToolHandler()).toBeInstanceOf(
      handlers.ListSessionsToolHandler
    );
  });

  it('should have toolHandlers object', () => {
    expect(typeof handlers.toolHandlers).toBe('object');
    expect(Object.keys(handlers.toolHandlers)).toEqual(
      expect.arrayContaining([
        TOOLS.CODEX,
        TOOLS.PING,
        TOOLS.HELP,
        TOOLS.LIST_SESSIONS,
      ])
    );
  });

  // ---------------------------------------------------------------------------
  // CodexToolHandler
  // ---------------------------------------------------------------------------
  describe('CodexToolHandler', () => {
    it('throws ToolExecutionError (wrapped) if prompt is missing and no pageToken', async () => {
      const handler = new handlers.CodexToolHandler();
      await expect(handler.execute({})).rejects.toThrow(
        /Failed to execute codex command/i
      );
      expect(command.executeCommandStreamed).not.toHaveBeenCalled();
    });

    it('returns paginated output if output is long', async () => {
      const longOut = 'a'.repeat(50_000);
      mockExecuteCommandStreamed.mockResolvedValue({
        stdout: longOut,
        stderr: '',
      });
      const handler = new handlers.CodexToolHandler();

      const res = await handler.execute({ prompt: 'foo', pageSize: 1000 });

      expect(res.content[0].type).toBe('text');
      expect(res.content[0].text.length).toBe(1000);
      expect(res.content[1].text).toContain('"nextPageToken":"token123"');
      expect(res.meta?.nextPageToken).toBe('token123');
      expect(command.executeCommandStreamed).toHaveBeenCalledTimes(1);
    });

    it('returns ONLY the head and no meta/token when remaining <= pageLen (pageToken path)', async () => {
      // Don’t pass pageSize (min 1000). Let default pageLen be large; return a tiny chunk to force no meta.
      mockPeekChunk.mockReturnValue('abc'); // length 3 <= default pageLen (~40000)
      const handler = new handlers.CodexToolHandler();
      const res = await handler.execute({ pageToken: 'tok' });

      expect(res.content).toHaveLength(1);
      expect(res.content[0].text).toBe('abc');
      expect(res.meta).toBeUndefined();
      expect(mockAdvanceChunk).toHaveBeenCalledWith('tok', 3);
    });

    it('clears session if sessionId and resetSession are provided', async () => {
      mockExecuteCommandStreamed.mockResolvedValue({
        stdout: 'output',
        stderr: '',
      });
      const handler = new handlers.CodexToolHandler();
      await handler.execute({
        prompt: 'foo',
        sessionId: 'sess',
        resetSession: true,
      });
      expect(mockClearSession).toHaveBeenCalledWith('sess');
    });

    it('appends full turns when output fits in a single page', async () => {
      mockExecuteCommandStreamed.mockResolvedValue({
        stdout: 'short answer',
        stderr: '',
      });
      const handler = new handlers.CodexToolHandler();
      await handler.execute({ prompt: 'hello', sessionId: 'sess' });
      // two appends: user + assistant
      expect(mockAppendTurn).toHaveBeenCalledTimes(2);
      expect(mockAppendTurn).toHaveBeenNthCalledWith(
        1,
        'sess',
        'user',
        'hello'
      );
      expect(mockAppendTurn).toHaveBeenNthCalledWith(
        2,
        'sess',
        'assistant',
        'short answer'
      );
    });

    it('uses stitched prior transcript when present', async () => {
      mockGetTranscript.mockReturnValue([
        { role: 'user', text: 'u1', at: Date.now() },
        { role: 'assistant', text: 'a1', at: Date.now() },
      ]);
      mockExecuteCommandStreamed.mockResolvedValue({
        stdout: 'ok',
        stderr: '',
      });
      const handler = new handlers.CodexToolHandler();
      await handler.execute({ prompt: 'new', sessionId: 'sess' });

      // ensure buildPromptWithSentinels is called with stitched context
      expect(mockBuildPromptWithSentinels).toHaveBeenCalledWith(
        'runid',
        expect.stringContaining('User: u1\nAssistant: a1'),
        'new'
      );
    });

    it('returns ValidationError on Zod validation failure (wrong type)', async () => {
      const handler = new handlers.CodexToolHandler();
      await expect(
        handler.execute({ pageSize: 'nope' } as any)
      ).rejects.toThrow(/Invalid/i);
      expect(command.executeCommandStreamed).not.toHaveBeenCalled();
    });

    it('returns ToolExecutionError if execution fails', async () => {
      mockExecuteCommandStreamed.mockRejectedValue(new Error('fail'));
      const handler = new handlers.CodexToolHandler();
      await expect(handler.execute({ prompt: 'foo' })).rejects.toThrow(
        /Failed to execute codex command/i
      );
      expect(command.executeCommandStreamed).toHaveBeenCalledTimes(1);
    });

    it('returns pageToken error if peekChunk returns nothing', async () => {
      mockPeekChunk.mockReturnValue(undefined);
      const handler = new handlers.CodexToolHandler();
      const res = await handler.execute({ pageToken: 'tok' });
      expect(res.content[0].text).toMatch(/No data found for pageToken/i);
      expect(command.executeCommandStreamed).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // ListSessionsToolHandler
  // ---------------------------------------------------------------------------
  describe('ListSessionsToolHandler', () => {
    it('returns session list', async () => {
      mockListSessionIds.mockReturnValue(['a', 'b']);
      const handler = new handlers.ListSessionsToolHandler();
      const res = await handler.execute({});
      expect(res.content[0].text).toBe('a\nb');
    });

    it('returns no sessions message', async () => {
      mockListSessionIds.mockReturnValue([]);
      const handler = new handlers.ListSessionsToolHandler();
      const res = await handler.execute({});
      expect(res.content[0].text).toBe('No active sessions.');
    });

    it('propagates ToolExecutionError on underlying error', async () => {
      mockListSessionIds.mockImplementation(() => {
        throw new Error('fail');
      });
      const handler = new handlers.ListSessionsToolHandler();
      await expect(handler.execute({})).rejects.toThrow(
        /Failed to list sessions/i
      );
    });
  });

  // ---------------------------------------------------------------------------
  // PingToolHandler
  // ---------------------------------------------------------------------------
  describe('PingToolHandler', () => {
    it('returns pong by default', async () => {
      const handler = new handlers.PingToolHandler();
      const res = await handler.execute({});
      expect(res.content[0].text).toBe('pong');
    });

    it('returns custom message', async () => {
      const handler = new handlers.PingToolHandler();
      const res = await handler.execute({ message: 'hi' });
      expect(res.content[0].text).toBe('hi');
    });

    it('throws ValidationError on Zod error (wrong type)', async () => {
      const handler = new handlers.PingToolHandler();
      await expect(handler.execute({ message: 123 } as any)).rejects.toThrow(
        /Invalid input/i
      );
    });
  });

  // ---------------------------------------------------------------------------
  // HelpToolHandler
  // ---------------------------------------------------------------------------
  describe('HelpToolHandler', () => {
    it('returns help output', async () => {
      mockExecuteCommand.mockResolvedValue({ stdout: 'help info', stderr: '' });
      const handler = new handlers.HelpToolHandler();
      const res = await handler.execute({});
      expect(res.content[0].text).toContain('help info');
      expect(command.executeCommand).toHaveBeenCalledWith('codex', ['--help']);
    });

    it('propagates ToolExecutionError on command failure', async () => {
      mockExecuteCommand.mockRejectedValue(new Error('fail'));
      const handler = new handlers.HelpToolHandler();
      await expect(handler.execute({})).rejects.toThrow(
        /Failed to execute help command/i
      );
    });
  });
});
