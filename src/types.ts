import { z } from 'zod';

// Tool constants
export const TOOLS = {
  CODEX: 'codex',
  REVIEW: 'review',
  PING: 'ping',
  HELP: 'help',
  LIST_SESSIONS: 'listSessions',
} as const;

export type ToolName = typeof TOOLS[keyof typeof TOOLS];

// Codex model constants
export const DEFAULT_CODEX_MODEL = 'gpt-5.3-codex' as const;
export const CODEX_DEFAULT_MODEL_ENV_VAR = 'CODEX_DEFAULT_MODEL' as const;

// Available model options (for documentation/reference)
export const AVAILABLE_CODEX_MODELS = [
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.1-codex',
  'gpt-5.1-codex-max',
  'gpt-5-codex',
  'gpt-4o',
  'gpt-4',
  'o3',
  'o4-mini',
] as const;

// Helper function to generate model description
export const getModelDescription = (toolType: 'codex' | 'review') => {
  const modelList = AVAILABLE_CODEX_MODELS.join(', ');
  if (toolType === 'codex') {
    return `Specify which model to use (defaults to ${DEFAULT_CODEX_MODEL}). Options: ${modelList}`;
  }
  return `Specify which model to use for the review (defaults to ${DEFAULT_CODEX_MODEL})`;
};

// Tool annotations for MCP 2025-11-25 spec
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

// Tool definition interface
export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  outputSchema?: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
  annotations?: ToolAnnotations;
}

// Tool result interface matching MCP SDK expectations
export interface ToolResult {
  content: Array<{
    type: 'text';
    text: string;
    _meta?: Record<string, unknown>;
  }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

// Server configuration
export interface ServerConfig {
  name: string;
  version: string;
}

// Sandbox mode enum
export const SandboxMode = z.enum([
  'read-only',
  'workspace-write',
  'danger-full-access',
]);

// Zod schemas for tool arguments
export const CodexToolSchema = z.object({
  prompt: z.string(),
  sessionId: z
    .string()
    .max(256, { error: 'Session ID must be 256 characters or fewer' })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      error: 'Session ID can only contain letters, numbers, hyphens, and underscores',
    })
    .optional(),
  resetSession: z.boolean().optional(),
  model: z.string().optional(),
  reasoningEffort: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
  sandbox: SandboxMode.optional(),
  fullAuto: z.boolean().optional(),
  workingDirectory: z.string().optional(),
  callbackUri: z.string().optional(),
});

// Review tool schema
export const ReviewToolSchema = z.object({
  prompt: z.string().optional(),
  uncommitted: z.boolean().optional(),
  base: z.string().optional(),
  commit: z.string().optional(),
  title: z.string().optional(),
  model: z.string().optional(),
  workingDirectory: z.string().optional(),
});

export const PingToolSchema = z.object({
  message: z.string().optional(),
});

export const HelpToolSchema = z.object({});

export const ListSessionsToolSchema = z.object({});

export type CodexToolArgs = z.infer<typeof CodexToolSchema>;
export type ReviewToolArgs = z.infer<typeof ReviewToolSchema>;
export type PingToolArgs = z.infer<typeof PingToolSchema>;
export type ListSessionsToolArgs = z.infer<typeof ListSessionsToolSchema>;

// Command execution result
export interface CommandResult {
  stdout: string;
  stderr: string;
}

// Progress token from MCP request metadata
export type ProgressToken = string | number;

// Context passed to tool handlers for sending progress notifications
export interface ToolHandlerContext {
  progressToken?: ProgressToken;
  sendProgress: (message: string, progress?: number, total?: number) => Promise<void>;
}
