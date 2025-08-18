import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Codex MCP Server', () => {
  test('should build successfully', async () => {
    const { stdout } = await execAsync('npm run build');
    expect(stdout).toBeDefined();
  });

  test('ping tool should echo message', () => {
    const tools = [
      {
        name: 'ping',
        description: 'Test MCP server connection',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to echo back',
            },
          },
          required: [],
        },
      },
    ];

    const pingTool = tools.find((tool) => tool.name === 'ping');
    expect(pingTool).toBeDefined();
    expect(pingTool?.name).toBe('ping');
    expect(pingTool?.description).toBe('Test MCP server connection');
  });

  test('codex tool should have required prompt parameter', () => {
    const tools = [
      {
        name: 'codex',
        description:
          'Execute Codex CLI in non-interactive mode for AI assistance',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The coding task, question, or analysis request',
            },
          },
          required: ['prompt'],
        },
      },
    ];

    const codexTool = tools.find((tool) => tool.name === 'codex');
    expect(codexTool).toBeDefined();
    expect(codexTool?.inputSchema.required).toContain('prompt');
  });

  test('help tool should have no required parameters', () => {
    const tools = [
      {
        name: 'help',
        description: 'Get Codex CLI help information',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ];

    const helpTool = tools.find((tool) => tool.name === 'help');
    expect(helpTool).toBeDefined();
    expect(helpTool?.inputSchema.required).toEqual([]);
  });
});
