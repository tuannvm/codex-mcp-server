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
          description:
            'Optional session ID for conversational context. Note: when resuming a session, sandbox/fullAuto/workingDirectory parameters are not applied (CLI limitation)',
        },
        resetSession: {
          type: 'boolean',
          description:
            'Reset the session history before processing this request',
        },
        model: {
          type: 'string',
          description:
            'Specify which model to use (defaults to gpt-5.2-codex). Options: gpt-5.2-codex, gpt-5.1-codex, gpt-5.1-codex-max, gpt-5-codex, gpt-4o, gpt-4, o3, o4-mini',
        },
        reasoningEffort: {
          type: 'string',
          enum: ['minimal', 'low', 'medium', 'high'],
          description:
            'Control reasoning depth (minimal < low < medium < high)',
        },
        sandbox: {
          type: 'string',
          enum: ['read-only', 'workspace-write', 'danger-full-access'],
          description:
            'Sandbox policy for shell command execution. read-only: no writes allowed, workspace-write: writes only in workspace, danger-full-access: full system access (dangerous)',
        },
        fullAuto: {
          type: 'boolean',
          description:
            'Enable full-auto mode: sandboxed automatic execution without approval prompts (equivalent to -a on-request --sandbox workspace-write)',
        },
        workingDirectory: {
          type: 'string',
          description:
            'Working directory for the agent to use as its root (passed via -C flag)',
        },
        callbackUri: {
          type: 'string',
          description:
            'Static MCP callback URI to pass to Codex via environment (if provided)',
        },
      },
      required: ['prompt'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string' },
      },
    },
    annotations: {
      title: 'Execute Codex CLI',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: TOOLS.REVIEW,
    description:
      'Run a code review against the current repository using Codex CLI',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Custom review instructions or focus areas',
        },
        uncommitted: {
          type: 'boolean',
          description:
            'Review staged, unstaged, and untracked changes (working tree)',
        },
        base: {
          type: 'string',
          description:
            'Review changes against a specific base branch (e.g., "main", "develop")',
        },
        commit: {
          type: 'string',
          description: 'Review the changes introduced by a specific commit SHA',
        },
        title: {
          type: 'string',
          description: 'Optional title to display in the review summary',
        },
        model: {
          type: 'string',
          description:
            'Specify which model to use for the review (defaults to gpt-5.2-codex)',
        },
        workingDirectory: {
          type: 'string',
          description: 'Working directory containing the repository to review',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Code Review',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
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
    annotations: {
      title: 'Ping Server',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
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
    annotations: {
      title: 'Get Help',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
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
    annotations: {
      title: 'List Sessions',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];
