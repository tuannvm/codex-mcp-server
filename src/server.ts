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
  type ToolHandlerContext,
  type ProgressToken,
  TOOLS,
} from './types.js';
import { handleError } from './errors.js';
import { toolDefinitions } from './tools/definitions.js';
import { toolHandlers } from './tools/handlers.js';

export class CodexMcpServer {
  private readonly server: Server;
  private readonly config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
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
      const createProgressContext = (): ToolHandlerContext => {
        let progressCount = 0;
        let done = false;
        return {
          progressToken,
          done: () => { done = true; },
          sendProgress: async (message: string, progress?: number, total?: number) => {
            if (!progressToken || done) return;

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
        if (!this.isValidToolName(name)) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const handler = toolHandlers[name];
        const context = createProgressContext();
        const result = await handler.execute(args, context);
        context.done?.();
        return result;
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

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(chalk.green(`${this.config.name} started successfully`));
  }
}
