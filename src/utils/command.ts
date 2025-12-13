import { spawn } from 'child_process';
import chalk from 'chalk';
import { CommandExecutionError } from '../errors.js';
import { type CommandResult } from '../types.js';

/**
 * Escape argument for Windows shell
 */
function escapeArgForWindows(arg: string): string {
  // If arg contains spaces or special chars, wrap in double quotes
  if (/[\s"&|<>^]/.test(arg)) {
    // Escape internal double quotes
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return arg;
}

export async function executeCommand(
  file: string,
  args: string[] = [],
  stdinData?: string
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';

    // Escape args for Windows shell
    const escapedArgs = isWindows
      ? args.map(escapeArgForWindows)
      : args;

    console.error(chalk.blue('Executing:'), file, escapedArgs.join(' '));

    const child = spawn(file, escapedArgs, {
      shell: isWindows,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // stdin으로 데이터 전달
    if (stdinData) {
      child.stdin.write(stdinData);
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (stderr) {
        console.error(chalk.yellow('Command stderr:'), stderr);
      }

      // Accept exit code 0 or if we got stdout output
      if (code === 0 || stdout) {
        resolve({ stdout, stderr });
      } else {
        reject(new CommandExecutionError(
          [file, ...args].join(' '),
          `Command failed with exit code ${code}`,
          new Error(stderr || 'Unknown error')
        ));
      }
    });

    child.on('error', (error) => {
      reject(new CommandExecutionError(
        [file, ...args].join(' '),
        'Command execution failed',
        error
      ));
    });
  });
}
