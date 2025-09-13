import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { CommandExecutionError } from '../errors.js';
import { type CommandResult } from '../types.js';

const execFileAsync = promisify(execFile);

export async function executeCommand(
  file: string,
  args: string[] = []
): Promise<CommandResult> {
  try {
    console.error(chalk.blue('Executing:'), file, args.join(' '));

    const result = await execFileAsync(file, args, {
      shell: false,
      maxBuffer: 64 * 1024 * 1024, // 64MB
    });

    if (result.stderr) {
      console.error(chalk.yellow('Command stderr:'), result.stderr);
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    throw new CommandExecutionError(
      [file, ...args].join(' '),
      'Command execution failed',
      error
    );
  }
}

/**
 * Streamed execution to avoid maxBuffer limits and begin processing output as it arrives.
 * Accumulates stdout into a single string by default; callers may hook into onChunk
 * to implement custom chunking if desired.
 */
export async function executeCommandStreamed(
  file: string,
  args: string[] = [],
  onChunk?: (chunk: string) => void
): Promise<CommandResult> {
  console.error(chalk.blue('Executing (streamed):'), file, args.join(' '));

  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(file, args, { shell: false });
    let stdout = '';
    let stderr = '';

    // Ensure strings
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (d: string) => {
      stdout += d;
      try {
        onChunk?.(d);
      } catch (e) {
        // Non-fatal: continue running even if onChunk throws.
        console.error(chalk.yellow('onChunk error:'), e);
      }
    });

    child.stderr.on('data', (d: string) => {
      stderr += d;
    });

    child.on('error', (err) => {
      reject(
        new CommandExecutionError(
          [file, ...args].join(' '),
          'Spawn failed',
          err
        )
      );
    });

    child.on('close', (code) => {
      if (stderr) {
        console.error(chalk.yellow('Command stderr:'), stderr);
      }
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new CommandExecutionError(
            [file, ...args].join(' '),
            `Exited with code ${code}`,
            stderr || code
          )
        );
      }
    });
  });
}
