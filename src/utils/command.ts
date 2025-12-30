import { spawn } from 'child_process';
import { Buffer } from 'node:buffer';
import chalk from 'chalk';
import { CommandExecutionError } from '../errors.js';
import { type CommandResult } from '../types.js';
import { escapeArgForWindowsShell } from './escape.js';

const isWindows = process.platform === 'win32';

// Maximum buffer size (10MB) to prevent memory exhaustion from noisy processes
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

export type ProgressCallback = (message: string) => void;

export interface StreamingCommandOptions {
  onProgress?: ProgressCallback;
}

export async function executeCommand(
  file: string,
  args: string[] = []
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    // Escape args for Windows shell to prevent injection
    // Note: file is not escaped - it should be a simple command name (e.g., "codex", "node")
    const escapedArgs = isWindows ? args.map(escapeArgForWindowsShell) : args;

    console.error(chalk.blue('Executing:'), file, escapedArgs.join(' '));

    const child = spawn(file, escapedArgs, {
      // Use shell on Windows to resolve .cmd/.bat executables (e.g., codex.cmd)
      shell: isWindows,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;

    child.stdout.on('data', (data: Buffer) => {
      if (!stdoutTruncated) {
        const chunk = data.toString();
        if (stdout.length + chunk.length > MAX_BUFFER_SIZE) {
          stdout += chunk.slice(0, MAX_BUFFER_SIZE - stdout.length);
          stdoutTruncated = true;
          console.error(chalk.yellow('Warning: stdout truncated at 10MB'));
        } else {
          stdout += chunk;
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      if (!stderrTruncated) {
        const chunk = data.toString();
        if (stderr.length + chunk.length > MAX_BUFFER_SIZE) {
          stderr += chunk.slice(0, MAX_BUFFER_SIZE - stderr.length);
          stderrTruncated = true;
          console.error(chalk.yellow('Warning: stderr truncated at 10MB'));
        } else {
          stderr += chunk;
        }
      }
    });

    child.on('close', (code) => {
      if (stderr) {
        console.error(chalk.yellow('Command stderr:'), stderr);
      }

      // Accept exit code 0 or if we got stdout output
      // Note: Unlike executeCommandStreaming, we only accept stdout here
      // to avoid silently swallowing failures that only produce stderr
      if (code === 0 || stdout) {
        if (code !== 0 && stdout) {
          console.error(
            chalk.yellow('Command failed but produced output, using stdout')
          );
        }
        resolve({ stdout, stderr });
      } else {
        reject(
          new CommandExecutionError(
            [file, ...args].join(' '),
            `Command failed with exit code ${code}`,
            new Error(stderr || 'Unknown error')
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

/**
 * Execute a command with streaming output support.
 * Calls onProgress callback with each chunk of output for real-time feedback.
 *
 * Note: This function accepts exit code 0 with any output (stdout or stderr),
 * since tools like codex write their primary output to stderr. However, non-zero
 * exit codes are only accepted if there's stdout output, to avoid masking errors.
 */
export async function executeCommandStreaming(
  file: string,
  args: string[] = [],
  options: StreamingCommandOptions = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    // Escape args for Windows shell to prevent injection
    // Note: file is not escaped - it should be a simple command name (e.g., "codex", "node")
    const escapedArgs = isWindows ? args.map(escapeArgForWindowsShell) : args;

    console.error(
      chalk.blue('Executing (streaming):'),
      file,
      escapedArgs.join(' ')
    );

    const child = spawn(file, escapedArgs, {
      // Use shell on Windows to resolve .cmd/.bat executables (e.g., codex.cmd)
      shell: isWindows,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;
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
      if (!stdoutTruncated) {
        if (stdout.length + chunk.length > MAX_BUFFER_SIZE) {
          stdout += chunk.slice(0, MAX_BUFFER_SIZE - stdout.length);
          stdoutTruncated = true;
          console.error(chalk.yellow('Warning: stdout truncated at 10MB'));
        } else {
          stdout += chunk;
        }
      }
      sendProgress(chunk.trim());
    });

    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (!stderrTruncated) {
        if (stderr.length + chunk.length > MAX_BUFFER_SIZE) {
          stderr += chunk.slice(0, MAX_BUFFER_SIZE - stderr.length);
          stderrTruncated = true;
          console.error(chalk.yellow('Warning: stderr truncated at 10MB'));
        } else {
          stderr += chunk;
        }
      }
      // Also send stderr as progress - codex outputs to stderr
      sendProgress(chunk.trim());
    });

    child.on('close', (code) => {
      // Send final progress if there's any remaining output
      if (options.onProgress && (stdout || stderr)) {
        const finalOutput = stdout || stderr;
        const lastChunk = finalOutput.slice(-500); // Last 500 chars
        if (lastChunk.trim()) {
          options.onProgress(
            `[Completed] ${lastChunk.trim().slice(0, 200)}...`
          );
        }
      }

      // Accept exit code 0, or non-zero with stdout output.
      // Do NOT accept non-zero with only stderr - this would mask ENOENT errors
      // when shell: true is used (command not found produces stderr, not 'error' event)
      if (code === 0 || stdout) {
        if (code !== 0 && stdout) {
          console.error(
            chalk.yellow('Command failed but produced stdout, using output')
          );
        }
        resolve({ stdout, stderr });
      } else {
        reject(
          new CommandExecutionError(
            [file, ...args].join(' '),
            `Command exited with code ${code}`,
            new Error(stderr || `Exit code: ${code}`)
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
