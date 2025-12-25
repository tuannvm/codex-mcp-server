import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { Buffer } from 'node:buffer';
import chalk from 'chalk';
import { CommandExecutionError } from '../errors.js';
import { type CommandResult } from '../types.js';

const execFileAsync = promisify(execFile);

export type ProgressCallback = (message: string) => void;

export interface StreamingCommandOptions {
  onProgress?: ProgressCallback;
}

export async function executeCommand(
  file: string,
  args: string[] = []
): Promise<CommandResult> {
  try {
    console.error(chalk.blue('Executing:'), file, args.join(' '));

    const result = await execFileAsync(file, args, {
      shell: false,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (result.stderr) {
      console.error(chalk.yellow('Command stderr:'), result.stderr);
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error: unknown) {
    // If command failed but produced stdout, treat it as success
    // This handles cases where codex exits with error code but still returns valid output
    if (error && typeof error === 'object' && 'stdout' in error) {
      const execError = error as { stdout: string; stderr?: string };
      if (execError.stdout) {
        console.error(
          chalk.yellow('Command failed but produced output, using stdout')
        );
        return {
          stdout: execError.stdout,
          stderr: execError.stderr || '',
        };
      }
    }
    throw new CommandExecutionError(
      [file, ...args].join(' '),
      'Command execution failed',
      error
    );
  }
}

/**
 * Execute a command with streaming output support.
 * Calls onProgress callback with each chunk of output for real-time feedback.
 */
export async function executeCommandStreaming(
  file: string,
  args: string[] = [],
  options: StreamingCommandOptions = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    console.error(chalk.blue('Executing (streaming):'), file, args.join(' '));

    const child = spawn(file, args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let lastProgressTime = 0;
    const PROGRESS_DEBOUNCE_MS = 100; // Debounce progress updates

    const sendProgress = (message: string) => {
      if (!options.onProgress) return;

      const now = Date.now();
      // Debounce to avoid flooding with progress updates
      if (now - lastProgressTime >= PROGRESS_DEBOUNCE_MS) {
        options.onProgress(message);
        lastProgressTime = now;
      }
    };

    child.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      sendProgress(chunk.trim());
    });

    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      // Also send stderr as progress - codex outputs to stderr
      sendProgress(chunk.trim());
    });

    child.on('close', (code) => {
      // Send final progress if there's any remaining output
      if (options.onProgress && (stdout || stderr)) {
        const finalOutput = stdout || stderr;
        const lastChunk = finalOutput.slice(-500); // Last 500 chars
        if (lastChunk.trim()) {
          options.onProgress(`[Completed] ${lastChunk.trim().slice(0, 200)}...`);
        }
      }

      if (code === 0 || stdout || stderr) {
        // Success or we have output (treat as success like the original)
        if (code !== 0 && (stdout || stderr)) {
          console.error(
            chalk.yellow('Command failed but produced output, using output')
          );
        }
        resolve({ stdout, stderr });
      } else {
        reject(
          new CommandExecutionError(
            [file, ...args].join(' '),
            `Command exited with code ${code}`,
            new Error(`Exit code: ${code}`)
          )
        );
      }
    });

    child.on('error', (error) => {
      reject(
        new CommandExecutionError(
          [file, ...args].join(' '),
          'Command execution failed',
          error
        )
      );
    });
  });
}
