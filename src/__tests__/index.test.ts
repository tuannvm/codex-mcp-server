// Mock chalk to avoid ESM issues in Jest
jest.mock('chalk', () => ({
  default: {
    blue: (text: string) => text,
    yellow: (text: string) => text,
    green: (text: string) => text,
    red: (text: string) => text,
  },
}));

// Mock command execution to avoid actual codex calls
jest.mock('../utils/command.js', () => ({
  executeCommand: jest.fn().mockResolvedValue({
    stdout: 'mocked output',
    stderr: '',
  }),
}));

// Mock playwright to avoid requiring it at test time
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn(),
          screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
          title: jest.fn().mockResolvedValue('Test Page'),
          url: jest.fn().mockReturnValue('https://example.com'),
          mouse: {
            click: jest.fn(),
            move: jest.fn(),
            down: jest.fn(),
            up: jest.fn(),
            wheel: jest.fn(),
          },
          keyboard: {
            press: jest.fn(),
            type: jest.fn(),
          },
          waitForLoadState: jest.fn(),
        }),
        close: jest.fn(),
      }),
      close: jest.fn(),
    }),
  },
}), { virtual: true });

import { TOOLS } from '../types.js';
import { toolDefinitions } from '../tools/definitions.js';
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  toolHandlers,
  CodexToolHandler,
  ReviewToolHandler,
  PingToolHandler,
  HelpToolHandler,
  ListSessionsToolHandler,
  WebSearchToolHandler,
} from '../tools/handlers.js';
import { InMemorySessionStorage } from '../session/storage.js';
import { CodexMcpServer } from '../server.js';
import { bridge } from '../browser-use/bridge.js';

describe('Codex MCP Server', () => {
  describe('Tool Definitions', () => {
    test('should have all required tools defined', () => {
      // 6 core tools + 10 browser tools = 16
      expect(toolDefinitions).toHaveLength(16);

      const toolNames = toolDefinitions.map((tool) => tool.name);
      expect(toolNames).toContain(TOOLS.CODEX);
      expect(toolNames).toContain(TOOLS.REVIEW);
      expect(toolNames).toContain(TOOLS.WEBSEARCH);
      expect(toolNames).toContain(TOOLS.PING);
      expect(toolNames).toContain(TOOLS.HELP);
      expect(toolNames).toContain(TOOLS.LIST_SESSIONS);
    });

    test('should have all browser tools defined', () => {
      const toolNames = toolDefinitions.map((tool) => tool.name);
      expect(toolNames).toContain(TOOLS.BROWSER_LAUNCH);
      expect(toolNames).toContain(TOOLS.BROWSER_SCREENSHOT);
      expect(toolNames).toContain(TOOLS.BROWSER_CLICK);
      expect(toolNames).toContain(TOOLS.BROWSER_TYPE);
      expect(toolNames).toContain(TOOLS.BROWSER_SCROLL);
      expect(toolNames).toContain(TOOLS.BROWSER_DRAG);
      expect(toolNames).toContain(TOOLS.BROWSER_KEY);
      expect(toolNames).toContain(TOOLS.BROWSER_NAVIGATE);
      expect(toolNames).toContain(TOOLS.BROWSER_CLOSE);
      expect(toolNames).toContain(TOOLS.BROWSER_STATUS);
    });

    test('codex tool should define output schema', () => {
      const codexTool = toolDefinitions.find(
        (tool) => tool.name === TOOLS.CODEX
      );
      expect(codexTool?.outputSchema).toBeDefined();
      expect(codexTool?.outputSchema?.type).toBe('object');
    });

    test('codex tool should have required prompt parameter', () => {
      const codexTool = toolDefinitions.find(
        (tool) => tool.name === TOOLS.CODEX
      );
      expect(codexTool).toBeDefined();
      expect(codexTool?.inputSchema.required).toContain('prompt');
      expect(codexTool?.description).toContain('Execute Codex CLI');
    });

    test('ping tool should have optional message parameter', () => {
      const pingTool = toolDefinitions.find((tool) => tool.name === TOOLS.PING);
      expect(pingTool).toBeDefined();
      expect(pingTool?.inputSchema.required).toEqual([]);
      expect(pingTool?.description).toContain('Test MCP server connection');
    });

    test('help tool should have no required parameters', () => {
      const helpTool = toolDefinitions.find((tool) => tool.name === TOOLS.HELP);
      expect(helpTool).toBeDefined();
      expect(helpTool?.inputSchema.required).toEqual([]);
      expect(helpTool?.description).toContain('Get Codex CLI help');
    });

    test('browser tools should have sessionId required', () => {
      const browserTools = toolDefinitions.filter((t) =>
        t.name.startsWith('browser_') && t.name !== 'browser_status'
      );
      for (const tool of browserTools) {
        expect(tool.inputSchema.required).toContain('sessionId');
      }
    });

    test('browser_status should have no required parameters', () => {
      const statusTool = toolDefinitions.find(
        (tool) => tool.name === TOOLS.BROWSER_STATUS
      );
      expect(statusTool).toBeDefined();
      expect(statusTool?.inputSchema.required).toEqual([]);
    });
  });

  describe('Tool Handlers', () => {
    test('should have handlers for all core tools', () => {
      expect(toolHandlers[TOOLS.CODEX]).toBeInstanceOf(CodexToolHandler);
      expect(toolHandlers[TOOLS.REVIEW]).toBeInstanceOf(ReviewToolHandler);
      expect(toolHandlers[TOOLS.WEBSEARCH]).toBeInstanceOf(
        WebSearchToolHandler
      );
      expect(toolHandlers[TOOLS.PING]).toBeInstanceOf(PingToolHandler);
      expect(toolHandlers[TOOLS.HELP]).toBeInstanceOf(HelpToolHandler);
      expect(toolHandlers[TOOLS.LIST_SESSIONS]).toBeInstanceOf(
        ListSessionsToolHandler
      );
    });

    test('should have handlers for all browser tools', () => {
      expect(toolHandlers[TOOLS.BROWSER_LAUNCH]).toBeDefined();
      expect(toolHandlers[TOOLS.BROWSER_SCREENSHOT]).toBeDefined();
      expect(toolHandlers[TOOLS.BROWSER_CLICK]).toBeDefined();
      expect(toolHandlers[TOOLS.BROWSER_TYPE]).toBeDefined();
      expect(toolHandlers[TOOLS.BROWSER_SCROLL]).toBeDefined();
      expect(toolHandlers[TOOLS.BROWSER_DRAG]).toBeDefined();
      expect(toolHandlers[TOOLS.BROWSER_KEY]).toBeDefined();
      expect(toolHandlers[TOOLS.BROWSER_NAVIGATE]).toBeDefined();
      expect(toolHandlers[TOOLS.BROWSER_CLOSE]).toBeDefined();
      expect(toolHandlers[TOOLS.BROWSER_STATUS]).toBeDefined();
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

    test('listSessions handler should return session info', async () => {
      const sessionStorage = new InMemorySessionStorage();
      const handler = new ListSessionsToolHandler(sessionStorage);
      const result = await handler.execute({});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('No active sessions');
    });

    test('review tool should have correct definition', () => {
      const reviewTool = toolDefinitions.find(
        (tool) => tool.name === TOOLS.REVIEW
      );
      expect(reviewTool).toBeDefined();
      expect(reviewTool?.inputSchema.required).toEqual([]);
      expect(reviewTool?.description).toContain('code review');
    });

    test('websearch tool should have correct definition', () => {
      const websearchTool = toolDefinitions.find(
        (tool) => tool.name === TOOLS.WEBSEARCH
      );
      expect(websearchTool).toBeDefined();
      expect(websearchTool?.inputSchema.required).toEqual(['query']);
      expect(websearchTool?.description).toContain('web search');
    });
  });

  describe('Browser Tool Handlers', () => {
    afterEach(async () => {
      await bridge.shutdown();
    });

    test('browser_status should return status JSON', async () => {
      const handler = toolHandlers[TOOLS.BROWSER_STATUS];
      const result = await handler.execute({});

      expect(result.content[0].type).toBe('text');
      const status = JSON.parse(result.content[0].text);
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('activeSessions');
      expect(status).toHaveProperty('sessionIds');
    });

    test('browser_launch should create a session', async () => {
      const handler = toolHandlers[TOOLS.BROWSER_LAUNCH];
      const result = await handler.execute({ sessionId: 'test-session-1' });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('test-session-1');
      expect(result.content[0].text).toContain('launched successfully');

      // Clean up
      const closeHandler = toolHandlers[TOOLS.BROWSER_CLOSE];
      await closeHandler.execute({ sessionId: 'test-session-1' });
    });

    test('browser_close should close a session', async () => {
      // First launch
      const launchHandler = toolHandlers[TOOLS.BROWSER_LAUNCH];
      await launchHandler.execute({ sessionId: 'test-session-close' });

      // Then close
      const closeHandler = toolHandlers[TOOLS.BROWSER_CLOSE];
      const result = await closeHandler.execute({ sessionId: 'test-session-close' });

      expect(result.content[0].text).toContain('test-session-close');
      expect(result.content[0].text).toContain('closed');
    });

    test('browser_screenshot should return image data', async () => {
      const launchHandler = toolHandlers[TOOLS.BROWSER_LAUNCH];
      await launchHandler.execute({ sessionId: 'test-screenshot' });

      const screenshotHandler = toolHandlers[TOOLS.BROWSER_SCREENSHOT];
      const result = await screenshotHandler.execute({ sessionId: 'test-screenshot' });

      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('image');
      expect(result.content[0].data).toBeDefined();
      expect(result.content[0].mimeType).toBe('image/png');
      expect(result.content[1].type).toBe('text');

      // Clean up
      const closeHandler = toolHandlers[TOOLS.BROWSER_CLOSE];
      await closeHandler.execute({ sessionId: 'test-screenshot' });
    });

    test('browser_click should return confirmation', async () => {
      const launchHandler = toolHandlers[TOOLS.BROWSER_LAUNCH];
      await launchHandler.execute({ sessionId: 'test-click' });

      const clickHandler = toolHandlers[TOOLS.BROWSER_CLICK];
      const result = await clickHandler.execute({ sessionId: 'test-click', x: 100, y: 200 });

      expect(result.content[0].text).toContain('100');
      expect(result.content[0].text).toContain('200');

      // Clean up
      const closeHandler = toolHandlers[TOOLS.BROWSER_CLOSE];
      await closeHandler.execute({ sessionId: 'test-click' });
    });

    test('browser_key should normalize key names', async () => {
      const launchHandler = toolHandlers[TOOLS.BROWSER_LAUNCH];
      await launchHandler.execute({ sessionId: 'test-key' });

      const keyHandler = toolHandlers[TOOLS.BROWSER_KEY];
      const result = await keyHandler.execute({ sessionId: 'test-key', key: 'Cmd+s' });

      expect(result.content[0].text).toContain('Cmd+s');

      // Clean up
      const closeHandler = toolHandlers[TOOLS.BROWSER_CLOSE];
      await closeHandler.execute({ sessionId: 'test-key' });
    });
  });

  describe('Server Initialization', () => {
    test('should initialize server with config', () => {
      const config = { name: 'test-server', version: '1.0.0' };
      const server = new CodexMcpServer(config);
      expect(server).toBeInstanceOf(CodexMcpServer);
    });
  });

  describe('MCP schema compatibility', () => {
    test('codex tool results should validate against CallToolResultSchema', () => {
      const result = {
        content: [{ type: 'text', text: 'ok', _meta: { threadId: 'th_123' } }],
        structuredContent: { threadId: 'th_123' },
        _meta: { model: 'gpt-5.3-codex' },
      };

      const parsed = CallToolResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    test('tool definitions should validate against ListToolsResultSchema', () => {
      const parsed = ListToolsResultSchema.safeParse({
        tools: toolDefinitions,
      });
      expect(parsed.success).toBe(true);
    });
  });
});
