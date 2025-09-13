import { z } from 'zod';

// Tool constants
export const TOOLS = {
  CODEX: 'codex',
  PING: 'ping',
  HELP: 'help',
} as const;

export type ToolName = (typeof TOOLS)[keyof typeof TOOLS];

// Tool definition interface
export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

// Tool result interface matching MCP SDK expectations
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  // Many clients/SDKs accept an optional top-level meta bag; harmless if ignored.
  meta?: Record<string, unknown>;
}

// Server configuration
export interface ServerConfig {
  name: string;
  version: string;
}

// Zod schemas for tool arguments
export const CodexToolSchema = z.object({
  prompt: z.string().optional(),
  pageSize: z.number().int().min(1000).max(200000).optional(),
  pageToken: z.string().optional(),
});

export const PingToolSchema = z.object({
  message: z.string().optional(),
});

export const HelpToolSchema = z.object({});

export type CodexToolArgs = z.infer<typeof CodexToolSchema>;
export type PingToolArgs = z.infer<typeof PingToolSchema>;

// Command execution result
export interface CommandResult {
  stdout: string;
  stderr: string;
}
