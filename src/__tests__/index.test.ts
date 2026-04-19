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
      // 6 core tools + 1 browser tool = 7
      expect(toolDefinitions).toHaveLength(7);

      const toolNames = toolDefinitions.map((tool) => tool.name);
      expect(toolNames).toContain(TOOLS.CODEX);
      expect(toolNames).toContain(TOOLS.REVIEW);
      expect(toolNames).toContain(TOOLS.WEBSEARCH);
      expect(toolNames).toContain(TOOLS.PING);
      expect(toolNames).toContain(TOOLS.HELP);
      expect(toolNames).toContain(TOOLS.LIST_SESSIONS);
    });

    test('should have browser tool defined', () => {
      const toolNames = toolDefinitions.map((tool) => tool.name);
      expect(toolNames).toContain(TOOLS.BROWSER);
    });

    test('browser tool should require action parameter', () => {
      const browserTool = toolDefinitions.find((tool) => tool.name === TOOLS.BROWSER);
      expect(browserTool).toBeDefined();
      expect(browserTool?.inputSchema.required).toContain('action');
      expect(browserTool?.inputSchema.required).not.toContain('sessionId');
    });

    test('browser tool should include all action types in enum', () => {
      const browserTool = toolDefinitions.find((tool) => tool.name === TOOLS.BROWSER);
      const actionEnum = browserTool?.inputSchema.properties.action as { enum: string[] };
      expect(actionEnum.enum).toEqual(
        expect.arrayContaining(['open', 'screenshot', 'navigate', 'click', 'type', 'key', 'scroll', 'drag', 'close', 'status'])
      );
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

    test('should have handler for browser tool', () => {
      expect(toolHandlers[TOOLS.BROWSER]).toBeDefined();
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

  describe('Browser Tool Handler', () => {
    afterEach(async () => {
      await bridge.shutdown();
    });

    const handler = () => toolHandlers[TOOLS.BROWSER];

    test('action=status should return status JSON', async () => {
      const result = await handler().execute({ action: 'status' });
      expect(result.content[0].type).toBe('text');
      const status = JSON.parse(result.content[0].text);
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('activeSessions');
      expect(status).toHaveProperty('sessionIds');
    });

    test('action=open should create a session', async () => {
      const result = await handler().execute({ action: 'open', sessionId: 'test-1' });
      expect(result.content[0].text).toContain('test-1');
      expect(result.content[0].text).toContain('opened');
      await handler().execute({ action: 'close', sessionId: 'test-1' });
    });

    test('action=open with url should navigate on launch', async () => {
      const result = await handler().execute({ action: 'open', sessionId: 'test-url', url: 'https://example.com' });
      expect(result.content[0].text).toContain('test-url');
      await handler().execute({ action: 'close', sessionId: 'test-url' });
    });

    test('action=close should close a session', async () => {
      await handler().execute({ action: 'open', sessionId: 'test-close' });
      const result = await handler().execute({ action: 'close', sessionId: 'test-close' });
      expect(result.content[0].text).toContain('test-close');
      expect(result.content[0].text).toContain('closed');
    });

    test('action=navigate should go to URL', async () => {
      await handler().execute({ action: 'open', sessionId: 'test-nav' });
      const result = await handler().execute({ action: 'navigate', sessionId: 'test-nav', url: 'https://example.com' });
      expect(result.content[0].text).toContain('Navigated');
      await handler().execute({ action: 'close', sessionId: 'test-nav' });
    });

    test('action=screenshot should return image data', async () => {
      await handler().execute({ action: 'open', sessionId: 'test-ss' });
      const result = await handler().execute({ action: 'screenshot', sessionId: 'test-ss' });
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('image');
      expect(result.content[0].data).toBeDefined();
      expect(result.content[0].mimeType).toBe('image/png');
      expect(result.content[1].type).toBe('text');
      await handler().execute({ action: 'close', sessionId: 'test-ss' });
    });

    test('action=click should return confirmation', async () => {
      await handler().execute({ action: 'open', sessionId: 'test-click' });
      const result = await handler().execute({ action: 'click', sessionId: 'test-click', x: 100, y: 200 });
      expect(result.content[0].text).toContain('100');
      expect(result.content[0].text).toContain('200');
      await handler().execute({ action: 'close', sessionId: 'test-click' });
    });

    test('action=type should type text', async () => {
      await handler().execute({ action: 'open', sessionId: 'test-type' });
      const result = await handler().execute({ action: 'type', sessionId: 'test-type', text: 'hello' });
      expect(result.content[0].text).toContain('Typed');
      expect(result.content[0].text).toContain('hello');
      await handler().execute({ action: 'close', sessionId: 'test-type' });
    });

    test('action=key should normalize key names', async () => {
      await handler().execute({ action: 'open', sessionId: 'test-key' });
      const result = await handler().execute({ action: 'key', sessionId: 'test-key', key: 'Cmd+s' });
      expect(result.content[0].text).toContain('Cmd+s');
      await handler().execute({ action: 'close', sessionId: 'test-key' });
    });

    test('action=scroll should scroll page', async () => {
      await handler().execute({ action: 'open', sessionId: 'test-scroll' });
      const result = await handler().execute({ action: 'scroll', sessionId: 'test-scroll', direction: 'down', amount: 500 });
      expect(result.content[0].text).toContain('down');
      expect(result.content[0].text).toContain('500');
      await handler().execute({ action: 'close', sessionId: 'test-scroll' });
    });

    test('action=drag should drag between coordinates', async () => {
      await handler().execute({ action: 'open', sessionId: 'test-drag' });
      const result = await handler().execute({ action: 'drag', sessionId: 'test-drag', fromX: 0, fromY: 0, toX: 100, toY: 100 });
      expect(result.content[0].text).toContain('Dragged');
      await handler().execute({ action: 'close', sessionId: 'test-drag' });
    });

    test('should reject invalid action', async () => {
      await expect(handler().execute({ action: 'invalid' })).rejects.toThrow('Validation failed');
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
