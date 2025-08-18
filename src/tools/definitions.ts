import { TOOLS, type ToolDefinition } from '../types.js';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: TOOLS.CODEX,
    description: 'Execute Codex CLI in non-interactive mode for AI assistance',
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
  {
    name: TOOLS.PING,
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
  {
    name: TOOLS.HELP,
    description: 'Get Codex CLI help information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
