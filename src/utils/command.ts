import { type SpawnOptionsWithoutStdio, spawn } from 'child_process';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import chalk from 'chalk';
import { CommandExecutionError } from '../errors.js';
import { type CommandResult } from '../types.js';
import { isCommandLoggingEnabled } from '../runtime-config.js';

type ProcessEnv = Record<string, string | undefined>;

/**
 * Escape argument for Windows shell (cmd.exe)
 */
function escapeArgForWindows(arg: string): string {
  // Escape percent signs to prevent environment variable expansion
  let escaped = arg.replace(/%/g, '%%');
  // If arg contains spaces or special chars, wrap in double quotes
  if (/[\s"&|<>^%]/.test(arg)) {
    // Escape internal double quotes using CMD-style doubling
    escaped = `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

const isWindows = process.platform === 'win32';

// Maximum buffer size (10MB) to prevent memory exhaustion from noisy processes
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

export type ProgressCallback = (message: string) => void;

export interface CommandOptions {
  envOverride?: ProcessEnv;
  cwd?: string;
  signal?: AbortSignal;
  onProgress?: ProgressCallback;
}

export type StreamingCommandOptions = CommandOptions;

type StreamName = 'stdout' | 'stderr';
type SpawnedChildProcess = ReturnType<typeof spawn>;

const FORCE_KILL_TIMEOUT_MS = 2000;
const PROGRESS_DEBOUNCE_MS = 100;

function getEscapedArgs(args: string[]): string[] {
  return isWindows ? args.map(escapeArgForWindows) : args;
}

function getSpawnOptions(
  options: CommandOptions = {}
): SpawnOptionsWithoutStdio {
  const spawnOptions: SpawnOptionsWithoutStdio = {
    shell: isWindows,
    env: options.envOverride
      ? { ...process.env, ...options.envOverride }
      : process.env,
  };

  if (options.cwd) {
    spawnOptions.cwd = path.resolve(options.cwd);
  }

  if (options.signal && !isWindows) {
    // Create an isolated process group so abort can terminate the full tree.
    spawnOptions.detached = true;
  }

  return spawnOptions;
}

function sendKillSignal(
  child: SpawnedChildProcess,
  signal: 'SIGTERM' | 'SIGKILL',
  isWindowsPlatform: boolean
): void {
  child.kill(signal);
  if (!isWindowsPlatform && child.pid) {
    try {
      process.kill(-child.pid, signal);
    } catch {
      // Ignore if process group no longer exists.
    }
  }
}

function killChild(
  child: SpawnedChildProcess,
  isWindowsPlatform: boolean
): void {
  sendKillSignal(child, 'SIGTERM', isWindowsPlatform);
  const forceKillTimer = globalThis.setTimeout(
    () => sendKillSignal(child, 'SIGKILL', isWindowsPlatform),
    FORCE_KILL_TIMEOUT_MS
  );
  child.once('exit', () => globalThis.clearTimeout(forceKillTimer));
}

function bindAbortSignal(
  child: SpawnedChildProcess,
  signal?: AbortSignal
): void {
  if (!signal) {
    return;
  }

  if (signal.aborted) {
    killChild(child, isWindows);
    return;
  }

  signal.addEventListener('abort', () => killChild(child, isWindows), {
    once: true,
  });
}

function appendOutput(
  currentValue: string,
  chunk: string,
  streamName: StreamName
): { nextValue: string; truncated: boolean } {
  if (currentValue.length + chunk.length > MAX_BUFFER_SIZE) {
    console.error(chalk.yellow(`Warning: ${streamName} truncated at 10MB`));
    return {
      nextValue:
        currentValue + chunk.slice(0, MAX_BUFFER_SIZE - currentValue.length),
      truncated: true,
    };
  }

  return {
    nextValue: currentValue + chunk,
    truncated: false,
  };
}

function createProgressReporter(
  onProgress?: ProgressCallback
): ProgressCallback | undefined {
  if (!onProgress) {
    return undefined;
  }

  let lastProgressTime = 0;
  return (message: string) => {
    const now = Date.now();
    if (now - lastProgressTime >= PROGRESS_DEBOUNCE_MS) {
      onProgress(message);
      lastProgressTime = now;
    }
  };
}

function createCommandError(
  file: string,
  args: string[],
  message: string,
  cause: unknown
): CommandExecutionError {
  return new CommandExecutionError([file, ...args].join(' '), message, cause);
}

export async function executeCommand(
  file: string,
  args: string[] = [],
  options: CommandOptions = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const escapedArgs = getEscapedArgs(args);
    const isStreaming = !!options.onProgress;
    const logLabel = isStreaming ? 'Executing (streaming):' : 'Executing:';
    const commandLoggingEnabled = isCommandLoggingEnabled();

    if (commandLoggingEnabled) {
      console.error(chalk.blue(logLabel), file, escapedArgs.join(' '));
    }

    const child = spawn(file, escapedArgs, getSpawnOptions(options));
    bindAbortSignal(child, options.signal);

    // Close stdin to prevent processes like codex exec from waiting forever for input
    // When spawned with stdio pipe, codex waits for stdin EOF that never arrives
    child.stdin?.end();

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;
    const reportProgress = createProgressReporter(options.onProgress);

    child.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (!stdoutTruncated) {
        const nextOutput = appendOutput(stdout, chunk, 'stdout');
        stdout = nextOutput.nextValue;
        stdoutTruncated = nextOutput.truncated;
      }
      reportProgress?.(chunk.trim());
    });

    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (!stderrTruncated) {
        const nextOutput = appendOutput(stderr, chunk, 'stderr');
        stderr = nextOutput.nextValue;
        stderrTruncated = nextOutput.truncated;
      }
      reportProgress?.(chunk.trim());
    });

    child.on('close', (code) => {
      if (options.onProgress && (stdout || stderr)) {
        const finalOutput = stdout || stderr;
        const lastChunk = finalOutput.slice(-500);
        if (lastChunk.trim()) {
          options.onProgress(
            `[Completed] ${lastChunk.trim().slice(0, 200)}...`
          );
        }
      }

      if (!isStreaming && stderr && commandLoggingEnabled) {
        console.error(chalk.yellow('Command stderr:'), stderr);
      }

      if (code === 0 || stdout || stderr) {
        if (code !== 0 && (stdout || stderr) && commandLoggingEnabled) {
          console.error(
            chalk.yellow('Command failed but produced output, using output')
          );
        }
        resolve({ stdout, stderr });
        return;
      }

      reject(
        isStreaming
          ? createCommandError(
              file,
              args,
              `Command exited with code ${code}`,
              new Error(`Exit code: ${code}`)
            )
          : createCommandError(
              file,
              args,
              `Command failed with exit code ${code}`,
              new Error(stderr || 'Unknown error')
            )
      );
    });

    child.on('error', (error) => {
      reject(createCommandError(file, args, 'Command execution failed', error));
    });
  });
}

/**
 * Execute a command with streaming output support.
 * Calls onProgress callback with each chunk of output for real-time feedback
 * by delegating to executeCommand with onProgress set.
 *
 * Note: Commands that produce stdout or stderr are treated as success even if
 * exit code is non-zero. This preserves codex CLI behavior, which frequently
 * writes primary output to stderr.
 */
export async function executeCommandStreaming(
  file: string,
  args: string[] = [],
  options: StreamingCommandOptions = {}
): Promise<CommandResult> {
  return executeCommand(file, args, options);
}
