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
import { executeCommand, executeCommandStreamed } from '../utils/command.js';

import { ZodError } from 'zod';
import { saveChunk, peekChunk, advanceChunk } from '../utils/cursorStore.js';

export class CodexToolHandler {
  async execute(args: unknown): Promise<ToolResult> {
    try {
      const { prompt, pageSize, pageToken }: CodexToolArgs =
        CodexToolSchema.parse(args);

      const DEFAULT_PAGE = Number(process.env.CODEX_PAGE_SIZE ?? 40000);
      const pageLen = Math.max(
        1000,
        Math.min(Number(pageSize ?? DEFAULT_PAGE), 200000)
      );

      // Subsequent page request
      if (pageToken) {
        const remaining = peekChunk(String(pageToken));
        if (!remaining) {
          return {
            content: [
              {
                type: 'text',
                text: 'No data found for pageToken (it may have expired).',
              },
            ],
          };
        }
        const head = remaining.slice(0, pageLen);
        const tail = remaining.slice(pageLen);
        // advance in-place; keep token stable for idempotent retries
        advanceChunk(String(pageToken), head.length);
        const meta = tail.length
          ? { nextPageToken: String(pageToken) }
          : undefined;
        return {
          content: [
            { type: 'text', text: head },
            ...(meta?.nextPageToken
              ? [
                  {
                    type: 'text' as const,
                    text: `{"nextPageToken":"${meta.nextPageToken}"}`,
                  },
                ]
              : []),
          ],
          ...(meta ? { meta } : {}),
        };
      }

      // First page request must have a prompt
      const cleanPrompt = String(prompt ?? '').trim();
      if (!cleanPrompt) {
        throw new ValidationError(
          TOOLS.CODEX,
          "Missing required 'prompt' (or provide a 'pageToken')."
        );
      }

      // Use streamed execution to avoid maxBuffer and handle very large outputs.
      const result = await executeCommandStreamed('codex', [
        'exec',
        cleanPrompt,
      ]);

      const output = result.stdout || 'No output from Codex';

      if (output.length <= pageLen) {
        return { content: [{ type: 'text', text: output }] };
      }

      const head = output.slice(0, pageLen);
      const tail = output.slice(pageLen);
      const meta = { nextPageToken: saveChunk(tail) };
      return {
        content: [
          { type: 'text', text: head },
          { type: 'text', text: `{"nextPageToken":"${meta.nextPageToken}"}` },
        ],
        meta,
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
