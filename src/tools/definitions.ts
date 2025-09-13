import { TOOLS, type ToolDefinition } from '../types.js';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: TOOLS.CODEX,
    description:
      'Execute Codex CLI in non-interactive mode for AI assistance. Supports pagination for large outputs. Conversational context is only preserved if a sessionId is provided; otherwise each call is stateless.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The coding task, question, or analysis request',
        },
        sessionId: {
          type: 'string',
          description:
            'Optional stable ID to enable conversational context across calls. If omitted, no context is maintained and each call is independent.',
        },
        resetSession: {
          type: 'boolean',
          description:
            'If true, clears the session identified by sessionId. Useful for `/clear` commands or starting a fresh session.',
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
    name: TOOLS.LIST_SESSIONS,
    description:
      'List all currently active sessionIds managed by the server (subject to TTL).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
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
