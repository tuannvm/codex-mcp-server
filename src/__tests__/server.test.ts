import { jest } from '@jest/globals';

// ESM mocks must be set up before importing the module under test
let ServerMock: any;
let StdioServerTransportMock: any;
let chalkMock: any;
ServerMock = jest.fn().mockImplementation(() => ({
  setRequestHandler: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
}));
StdioServerTransportMock = jest.fn();
chalkMock = {
  green: jest.fn((msg: any) => `[green]${msg}`),
  yellow: jest.fn((msg: any) => `[yellow]${msg}`),
  red: jest.fn((msg: any) => `[red]${msg}`),
};
await jest.unstable_mockModule(
  '@modelcontextprotocol/sdk/server/index.js',
  () => ({
    Server: ServerMock,
  })
);
await jest.unstable_mockModule(
  '@modelcontextprotocol/sdk/server/stdio.js',
  () => ({
    StdioServerTransport: StdioServerTransportMock,
  })
);
await jest.unstable_mockModule('chalk', () => ({
  default: chalkMock,
}));

describe('CodexMcpServer', () => {
  it('should instantiate with config', async () => {
    const { CodexMcpServer } = await import('../server');
    const config = { name: 'test', version: '1.0.0' };
    const server = new CodexMcpServer(config);
    expect(server).toBeInstanceOf(CodexMcpServer);
  });

  // Add more tests for server methods if possible (mock dependencies)

  describe('handlers and start()', () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });

    let processOnSpy: any;
    let processExitSpy: any;
    let originalProcessOn: any;
    let originalProcessExit: any;
    let originalConsoleError: any;

    beforeAll(() => {
      jest.useFakeTimers();
    });

    beforeEach(() => {
      // Save and mock process.on and process.exit
      originalProcessOn = process.on;
      originalProcessExit = process.exit;
      originalConsoleError = console.error;
      processOnSpy = jest.fn();
      processExitSpy = jest.fn();
      process.on = processOnSpy;
      process.exit = processExitSpy;
      console.error = jest.fn();
    });

    afterAll(() => {
      process.on = originalProcessOn;
      process.exit = originalProcessExit;
      console.error = originalConsoleError;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call start() and setup signal handlers', async () => {
      const { CodexMcpServer } = await import('../server');
      const config = { name: 'codex-mcp-server', version: '0.1.0' };
      const server = new CodexMcpServer(config);
      await server.start();
      expect(ServerMock).toHaveBeenCalled();
      expect(StdioServerTransportMock).toHaveBeenCalled();
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith(
        'SIGTERM',
        expect.any(Function)
      );
      expect(chalkMock.green).toHaveBeenCalledWith(
        'codex-mcp-server started successfully'
      );
      expect(console.error).toHaveBeenCalledWith(
        '[green]codex-mcp-server started successfully'
      );
    });

    it('should handle shutdown signal and close server', async () => {
      const { CodexMcpServer } = await import('../server');
      const config = { name: 'codex-mcp-server', version: '0.1.0' };
      const server = new CodexMcpServer(config);
      await server.start();
      // Find the shutdown handler
      const shutdownHandler = processOnSpy.mock.calls.find(
        ([signal]) => signal === 'SIGINT'
      )[1];
      await shutdownHandler('SIGINT');
      expect(chalkMock.yellow).toHaveBeenCalledWith(
        'Received SIGINT, shutting down MCP server...'
      );
      expect(console.error).toHaveBeenCalledWith(
        '[yellow]Received SIGINT, shutting down MCP server...'
      );
      // close() should be called
      const instance = ServerMock.mock.results[0].value;
      expect(instance.close).toHaveBeenCalled();
      // process.exit should be called (with delay)
      jest.runAllTimers(); // Flush setTimeout
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle error during shutdown', async () => {
      const { CodexMcpServer } = await import('../server');
      const config = { name: 'codex-mcp-server', version: '0.1.0' };
      const server = new CodexMcpServer(config);
      // Make close throw
      const instance = ServerMock.mock.results[0].value;
      instance.close.mockRejectedValueOnce(new Error('fail'));
      await server.start();
      const shutdownHandler = processOnSpy.mock.calls.find(
        ([signal]) => signal === 'SIGINT'
      )[1];
      await shutdownHandler('SIGINT');
      expect(chalkMock.red).toHaveBeenCalledWith('Error during shutdown:');
      expect(console.error).toHaveBeenCalledWith(
        '[red]Error during shutdown:',
        expect.any(Error)
      );
      jest.runAllTimers(); // Flush setTimeout
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should return error for invalid tool name', async () => {
      const { CodexMcpServer } = await import('../server');
      const config = { name: 'codex-mcp-server', version: '0.1.0' };
      const server = new CodexMcpServer(config);
      // The second call to setRequestHandler is for CallToolRequestSchema
      const setHandlerCalls =
        ServerMock.mock.results[0].value.setRequestHandler.mock.calls;
      const callToolHandler = setHandlerCalls[1]?.[1];
      if (!callToolHandler)
        throw new Error('CallToolRequestSchema handler not found');
      const response = await callToolHandler({
        params: { name: 'INVALID', arguments: {} },
      });
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Unknown tool: INVALID');
    });

    it('should return error if tool handler throws', async () => {
      // Use a real tool name and patch its handler to throw
      const { CodexMcpServer } = await import('../server');
      const config = { name: 'codex-mcp-server', version: '0.1.0' };
      const server = new CodexMcpServer(config);
      // Patch the CODEX handler to throw
      const handlers = (await import('../tools/handlers.js')).toolHandlers;
      jest
        .spyOn(handlers.codex, 'execute')
        .mockRejectedValue(new Error('fail'));
      // The second call to setRequestHandler is for CallToolRequestSchema
      const setHandlerCalls =
        ServerMock.mock.results[0].value.setRequestHandler.mock.calls;
      const callToolHandler = setHandlerCalls[1]?.[1];
      if (!callToolHandler)
        throw new Error('CallToolRequestSchema handler not found');
      const response = await callToolHandler({
        params: { name: 'codex', arguments: { prompt: 'foo' } },
      });
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('fail');
    });
  });
});
