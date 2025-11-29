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
        sessionId: {
          type: 'string',
          description: 'Optional session ID for conversational context',
        },
        resetSession: {
          type: 'boolean',
          description:
            'Reset the session history before processing this request',
        },
        model: {
          type: 'string',
          description:
            'Specify which model to use (defaults to gpt-5.1-codex). Options: gpt-5.1-codex, gpt-5-codex, gpt-4, gpt-3.5-turbo',
        },
        reasoningEffort: {
          type: 'string',
          enum: ['minimal', 'low', 'medium', 'high'],
          description:
            'Control reasoning depth (minimal < low < medium < high)',
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
  {
    name: TOOLS.LIST_SESSIONS,
    description: 'List all active conversation sessions with metadata',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
