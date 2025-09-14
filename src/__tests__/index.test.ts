jest.setTimeout(20000); // Increase timeout to 20 seconds for all tests
let TOOLS: any,
  toolDefinitions: any,
  toolHandlers: any,
  CodexToolHandler: any,
  PingToolHandler: any,
  HelpToolHandler: any,
  CodexMcpServer: any;
import { jest } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

describe('Codex MCP Server', () => {
  beforeAll(async () => {
    // ESM-compatible mocking
    await jest.unstable_mockModule('chalk', () => ({
      default: {
        blue: (text: any) => text,
        yellow: (text: any) => text,
        green: (text: any) => text,
        red: (text: any) => text,
      },
    }));
    await jest.unstable_mockModule('../utils/command.js', () => ({
      executeCommand: jest
        .fn<() => Promise<import('../types.js').CommandResult>>()
        .mockResolvedValue({
          stdout: 'mocked output',
          stderr: '',
        }),
      executeCommandStreamed: jest
        .fn<() => Promise<import('../types.js').CommandResult>>()
        .mockResolvedValue({
          stdout: 'mocked streamed output',
          stderr: '',
        }),
    }));
    // Dynamically import after mocks
    ({ TOOLS } = await import('../types.js'));
    ({ toolDefinitions } = await import('../tools/definitions.js'));
    ({ toolHandlers, CodexToolHandler, PingToolHandler, HelpToolHandler } =
      await import('../tools/handlers.js'));
    ({ CodexMcpServer } = await import('../server.js'));
  });
  test('should build successfully', async () => {
    jest.setTimeout(20000); // Increase timeout to 20 seconds
    const { stdout } = await execAsync('npm run build');
    expect(stdout).toBeDefined();
  });

  describe('Tool Definitions', () => {
    test('should have all required tools defined', () => {
      expect(toolDefinitions).toHaveLength(4);

      const toolNames = toolDefinitions.map(
        (tool: { name: string }) => tool.name
      );
      expect(toolNames).toContain(TOOLS.CODEX);
      expect(toolNames).toContain(TOOLS.PING);
      expect(toolNames).toContain(TOOLS.HELP);
      expect(toolNames).toContain(TOOLS.LIST_SESSIONS);
    });

    test('codex tool should have required prompt parameter', () => {
      const codexTool = toolDefinitions.find(
        (tool: { name: string }) => tool.name === TOOLS.CODEX
      );
      expect(codexTool).toBeDefined();
      // prompt is now optional to allow pageToken-only calls
      expect(codexTool?.inputSchema.required).toEqual([]);
      expect(codexTool?.description).toContain('Execute Codex CLI');
    });

    test('ping tool should have optional message parameter', () => {
      const pingTool = toolDefinitions.find(
        (tool: { name: string }) => tool.name === TOOLS.PING
      );
      expect(pingTool).toBeDefined();
      expect(pingTool?.inputSchema.required).toEqual([]);
      expect(pingTool?.description).toContain('Test MCP server connection');
    });

    test('help tool should have no required parameters', () => {
      const helpTool = toolDefinitions.find(
        (tool: { name: string }) => tool.name === TOOLS.HELP
      );
      expect(helpTool).toBeDefined();
      expect(helpTool?.inputSchema.required).toEqual([]);
      expect(helpTool?.description).toContain('Get Codex CLI help');
    });
  });

  describe('Tool Handlers', () => {
    test('should have handlers for all tools', () => {
      expect(toolHandlers[TOOLS.CODEX]).toBeInstanceOf(CodexToolHandler);
      expect(toolHandlers[TOOLS.PING]).toBeInstanceOf(PingToolHandler);
      expect(toolHandlers[TOOLS.HELP]).toBeInstanceOf(HelpToolHandler);
    });

    test('ping handler should return message', async () => {
      const handler = new PingToolHandler();
      const result = await handler.execute({ message: 'test' });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('test');
    });

    test('ping handler should use default message', async () => {
      const handler = new PingToolHandler();
      const result = await handler.execute({});

      expect(result.content[0].text).toBe('pong');
    });
  });

  describe('Server Initialization', () => {
    test('should initialize server with config', () => {
      const config = { name: 'test-server', version: '1.0.0' };
      const server = new CodexMcpServer(config);
      expect(server).toBeInstanceOf(CodexMcpServer);
    });
  });
});

describe('CLI entry (src/index.ts)', () => {
  let originalExit: any;
  let originalError: any;
  let CodexMcpServerMock: any;

  beforeAll(async () => {
    // Save originals
    originalExit = process.exit;
    originalError = console.error;
    // Mock process.exit and console.error
    process.exit = jest.fn();
    console.error = jest.fn();
    // ESM-compatible mocking for chalk and server
    await jest.unstable_mockModule('chalk', () => ({
      default: { red: jest.fn((msg: any) => `[red]${msg}`) },
    }));
    CodexMcpServerMock = jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(undefined),
    }));
    await jest.unstable_mockModule('../server.js', () => ({
      CodexMcpServer: CodexMcpServerMock,
    }));
  });

  afterAll(() => {
    process.exit = originalExit;
    console.error = originalError;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('main() starts server successfully', async () => {
    const { main } = await import('../index.js');
    await main();
    expect(CodexMcpServerMock).toHaveBeenCalled();
    expect(CodexMcpServerMock.mock.results[0].value.start).toBeDefined();
    expect(process.exit).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('main() handles server start error', async () => {
    CodexMcpServerMock.mockImplementationOnce(() => ({
      start: jest.fn().mockRejectedValue(new Error('fail')),
    }));
    const { main } = await import('../index.js');
    await main();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to start server:'),
      expect.any(Error)
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
