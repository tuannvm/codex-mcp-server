import {
  TOOLS,
  type ToolResult,
  type CodexToolArgs,
  type PingToolArgs,
  CodexToolSchema,
  PingToolSchema,
  HelpToolSchema,
} from '../types.js';
import { ToolExecutionError, ValidationError } from '../errors.js';
import { executeCommand } from '../utils/command.js';
import { ZodError } from 'zod';

export class CodexToolHandler {
  async execute(args: unknown): Promise<ToolResult> {
    try {
      const { prompt }: CodexToolArgs = CodexToolSchema.parse(args);

      const result = await executeCommand('codex', ['exec', prompt]);

      return {
        content: [
          {
            type: 'text',
            text: result.stdout || 'No output from Codex',
          },
        ],
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.CODEX, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.CODEX,
        'Failed to execute codex command',
        error
      );
    }
  }
}

export class PingToolHandler {
  async execute(args: unknown): Promise<ToolResult> {
    try {
      const { message = 'pong' }: PingToolArgs = PingToolSchema.parse(args);

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.PING, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.PING,
        'Failed to execute ping command',
        error
      );
    }
  }
}

export class HelpToolHandler {
  async execute(args: unknown): Promise<ToolResult> {
    try {
      HelpToolSchema.parse(args);

      const result = await executeCommand('codex', ['--help']);

      return {
        content: [
          {
            type: 'text',
            text: result.stdout || 'No help information available',
          },
        ],
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.HELP, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.HELP,
        'Failed to execute help command',
        error
      );
    }
  }
}

// Tool handler registry
export const toolHandlers = {
  [TOOLS.CODEX]: new CodexToolHandler(),
  [TOOLS.PING]: new PingToolHandler(),
  [TOOLS.HELP]: new HelpToolHandler(),
} as const;
