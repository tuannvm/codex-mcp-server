#!/usr/bin/env node

import chalk from 'chalk';
import { CodexMcpServer } from './server.js';

const SERVER_CONFIG = {
  name: 'codex-mcp-server',
  version: '0.1.0',
} as const;

async function main(): Promise<void> {
  try {
    const server = new CodexMcpServer(SERVER_CONFIG);
    await server.start();
  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}

main();

// Export main for testing purposes
export { main };

