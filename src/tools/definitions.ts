import { TOOLS, type ToolDefinition } from '../types.js';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: TOOLS.CODEX,
    description:
      'Execute Codex CLI in non-interactive mode for AI assistance (supports pagination for large outputs)',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The coding task, question, or analysis request',
        },
        pageSize: {
          type: 'number',
          description: 'Approximate characters per page (default 40000)',
        },
        pageToken: {
          type: 'string',
          description:
            'Opaque token returned by a previous call to fetch the next page',
        },
      },
      required: [], // prompt becomes optional to allow pageToken-only follow-ups
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
