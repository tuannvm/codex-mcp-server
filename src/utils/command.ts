import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { CommandExecutionError } from '../errors.js';
import { type CommandResult } from '../types.js';

const execAsync = promisify(exec);

export async function executeCommand(command: string): Promise<CommandResult> {
  try {
    console.log(chalk.blue('Executing:'), command);

    const result = await execAsync(command);

    if (result.stderr) {
      console.warn(chalk.yellow('Command stderr:'), result.stderr);
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    throw new CommandExecutionError(command, 'Command execution failed', error);
  }
}
