#!/usr/bin/env node

import chalk from 'chalk';
import { CodexMcpServer } from './server.js';
import { shutdownBrowserSessions } from './tools/handlers.js';

const SERVER_CONFIG = {
  name: 'codex-mcp-server',
  version: '0.0.6',
} as const;

async function main(): Promise<void> {
  try {
    const server = new CodexMcpServer(SERVER_CONFIG);
    await server.start();

    // Clean up browser sessions on shutdown
    const shutdown = async (signal: string) => {
      try {
        await shutdownBrowserSessions();
      } catch {
        // Best-effort cleanup
      }
      process.exit(signal === 'SIGINT' ? 130 : 0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}

main();
