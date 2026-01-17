import { exec } from 'child_process';
import { promisify } from 'util';

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
} from '../tools/handlers.js';
import { InMemorySessionStorage } from '../session/storage.js';
import { CodexMcpServer } from '../server.js';

const execAsync = promisify(exec);

describe('Codex MCP Server', () => {
  test('should build successfully', async () => {
    const { stdout } = await execAsync('npm run build');
    expect(stdout).toBeDefined();
  });

  describe('Tool Definitions', () => {
    test('should have all required tools defined', () => {
      expect(toolDefinitions).toHaveLength(5);

      const toolNames = toolDefinitions.map((tool) => tool.name);
      expect(toolNames).toContain(TOOLS.CODEX);
      expect(toolNames).toContain(TOOLS.REVIEW);
      expect(toolNames).toContain(TOOLS.PING);
      expect(toolNames).toContain(TOOLS.HELP);
      expect(toolNames).toContain(TOOLS.LIST_SESSIONS);
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
    test('should have handlers for all tools', () => {
      expect(toolHandlers[TOOLS.CODEX]).toBeInstanceOf(CodexToolHandler);
      expect(toolHandlers[TOOLS.REVIEW]).toBeInstanceOf(ReviewToolHandler);
      expect(toolHandlers[TOOLS.PING]).toBeInstanceOf(PingToolHandler);
      expect(toolHandlers[TOOLS.HELP]).toBeInstanceOf(HelpToolHandler);
      expect(toolHandlers[TOOLS.LIST_SESSIONS]).toBeInstanceOf(
        ListSessionsToolHandler
      );
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
        _meta: { model: 'gpt-5.2-codex' },
      };

      const parsed = CallToolResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    test('tool definitions should validate against ListToolsResultSchema', () => {
      const parsed = ListToolsResultSchema.safeParse({ tools: toolDefinitions });
      expect(parsed.success).toBe(true);
    });
  });
});
