import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import chalk from 'chalk';

import {
  type ServerConfig,
  type ToolName,
  type ToolResult,
  type ToolHandlerContext,
  type ProgressToken,
  TOOLS,
} from './types.js';
import { handleError } from './errors.js';
import { toolDefinitions } from './tools/definitions.js';
import { toolHandlers } from './tools/handlers.js';
import { isStartupLoggingEnabled } from './runtime-config.js';

export class CodexMcpServer {
  private readonly server: Server;
  private readonly config: ServerConfig;
  private callQueue: Promise<void> = Promise.resolve();
  private readonly toolTimeoutMs: number;

  constructor(config: ServerConfig) {
    this.config = config;
    this.toolTimeoutMs = this.getToolTimeoutMs();
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: toolDefinitions };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const { name, arguments: args } = request.params;
      const progressToken = request.params._meta?.progressToken as ProgressToken | undefined;

      // Create progress sender that uses MCP notifications
      const createProgressContext = (abortSignal?: AbortSignal): ToolHandlerContext => {
        let progressCount = 0;
        return {
          progressToken,
          abortSignal,
          sendProgress: async (message: string, progress?: number, total?: number) => {
            if (!progressToken) return;

            progressCount++;
            try {
              await extra.sendNotification({
                method: 'notifications/progress',
                params: {
                  progressToken,
                  progress: progress ?? progressCount,
                  total,
                  message,
                },
              });
            } catch (err) {
              // Log but don't fail the operation if progress notification fails
              console.error(chalk.yellow('Failed to send progress notification:'), err);
            }
          },
        };
      };

      try {
        return await new Promise<ToolResult>((resolve, reject) => {
          this.callQueue = this.callQueue.then(async () => {
            let operation: Promise<ToolResult> | undefined;

            try {
              if (!this.isValidToolName(name)) {
                throw new Error(`Unknown tool: ${name}`);
              }

              const handler = toolHandlers[name];
              const controller = new AbortController();
              const context = createProgressContext(controller.signal);
              const timeoutMs = this.getRequestTimeoutMs(name, args);
              operation = handler.execute(args, context);

              resolve(
                await this.withTimeout(
                  operation,
                  timeoutMs,
                  controller
                )
              );
            } catch (err) {
              reject(err);
            } finally {
              // Keep the queue blocked until the child process actually exits.
              await operation?.then(
                () => undefined,
                () => undefined
              );
            }
          });
        });
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: handleError(error, `tool "${name}"`),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private isValidToolName(name: string): name is ToolName {
    return Object.values(TOOLS).includes(name as ToolName);
  }

  private getToolTimeoutMs(): number {
    const rawTimeout = process.env.CODEX_TOOL_TIMEOUT_MS;
    if (!rawTimeout) {
      return 120_000;
    }

    const parsedTimeout = Number.parseInt(rawTimeout, 10);
    if (Number.isFinite(parsedTimeout) && parsedTimeout > 0) {
      return parsedTimeout;
    }

    return 120_000;
  }

  private getRequestTimeoutMs(name: ToolName, args: unknown): number {
    if (name !== TOOLS.CODEX || !args || typeof args !== 'object') {
      return this.toolTimeoutMs;
    }

    const timeoutMs = (args as { timeoutMs?: unknown }).timeoutMs;
    if (
      typeof timeoutMs === 'number' &&
      Number.isInteger(timeoutMs) &&
      timeoutMs > 0
    ) {
      return timeoutMs;
    }

    return this.toolTimeoutMs;
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    controller?: AbortController
  ): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          controller?.abort();
          reject(new Error(`Tool call timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      return await Promise.race([operation, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    if (isStartupLoggingEnabled()) {
      console.error(chalk.green(`${this.config.name} started successfully`));
    }
  }
}
