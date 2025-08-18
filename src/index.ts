#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

// Tool definitions
const tools = [
  {
    name: 'codex',
    description: 'Execute Codex CLI in non-interactive mode for AI assistance',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The coding task, question, or analysis request',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'ping',
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
    name: 'help',
    description: 'Get Codex CLI help information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Server setup
const server = new Server(
  {
    name: 'codex-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Error handling utility
function handleError(error: unknown, context: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`Error in ${context}:`), errorMessage);
  return `Error: ${errorMessage}`;
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'codex': {
        const schema = z.object({
          prompt: z.string(),
        });
        const { prompt } = schema.parse(args);

        console.log(chalk.blue('Executing:'), `codex exec "${prompt}"`);
        
        const { stdout, stderr } = await execAsync(`codex exec "${prompt}"`);
        
        if (stderr) {
          console.warn(chalk.yellow('Codex stderr:'), stderr);
        }

        return {
          content: [
            {
              type: 'text',
              text: stdout || 'No output from Codex',
            },
          ],
        };
      }

      case 'ping': {
        const schema = z.object({
          message: z.string().optional(),
        });
        const { message = 'pong' } = schema.parse(args);

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      }

      case 'help': {
        console.log(chalk.blue('Executing:'), 'codex --help');
        
        const { stdout, stderr } = await execAsync('codex --help');
        
        if (stderr) {
          console.warn(chalk.yellow('Codex help stderr:'), stderr);
        }

        return {
          content: [
            {
              type: 'text',
              text: stdout || 'No help information available',
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(chalk.green('Codex MCP Server started successfully'));
}

main().catch((error) => {
  console.error(chalk.red('Failed to start server:'), error);
  process.exit(1);
});