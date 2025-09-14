import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import chalk from 'chalk';

import { type ServerConfig, type ToolName, TOOLS } from './types.js';
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

/// <reference types="node" />
    // Call tool handler
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request, _extra) => {
        const { name, arguments: args } = request.params;
        try {
          if (!this.isValidToolName(name)) {
            throw new Error(`Unknown tool: ${name}`);
          }
          const handler = toolHandlers[name];
          // Ensure the return value matches the expected type
          const result = await handler.execute(args);
          return { ...result };
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
      }
    );
  }

  private isValidToolName(name: string): name is ToolName {
    return Object.values(TOOLS).includes(name as ToolName);
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(chalk.green(`${this.config.name} started successfully`));

    // Graceful shutdown so editors/clients don't see abrupt failures on reload/stop.
    const shutdown = async (signal: NodeJS.Signals) => {
      try {
        console.error(
          chalk.yellow(`Received ${signal}, shutting down MCP server...`)
        );
        await this.server.close();
      } catch (err) {
        console.error(chalk.red('Error during shutdown:'), err);
      } finally {
        // Let stdio flush, then exit
        setTimeout(() => process.exit(0), 10);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}
