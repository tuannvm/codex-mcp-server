#!/usr/bin/env node

import chalk from 'chalk';
import { CodexMcpServer } from './server.js';
import { SERVER_CONFIG } from './runtime-config.js';

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
