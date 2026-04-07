export class ToolExecutionError extends Error {
  constructor(
    public readonly toolName: string,
    message: string,
    public readonly cause?: unknown
  ) {
    const causeMsg = cause instanceof Error ? cause.message : '';
    const detail = causeMsg && causeMsg !== message ? ` (${causeMsg})` : '';
    super(`Failed to execute tool "${toolName}": ${message}${detail}`);
    this.name = 'ToolExecutionError';
  }
}

export class CommandExecutionError extends Error {
  constructor(
    public readonly command: string,
    message: string,
    public readonly cause?: unknown
  ) {
    const causeMsg = cause instanceof Error ? cause.message : '';
    const detail = causeMsg && causeMsg !== message ? ` (${causeMsg})` : '';
    super(`Command execution failed for "${command}": ${message}${detail}`);
    this.name = 'CommandExecutionError';
  }
}

export class ValidationError extends Error {
  constructor(
    public readonly toolName: string,
    message: string
  ) {
    super(`Validation failed for tool "${toolName}": ${message}`);
    this.name = 'ValidationError';
  }
}

export function handleError(error: unknown, context: string): string {
  if (error instanceof Error) {
    return `Error in ${context}: ${error.message}`;
  }
  return `Error in ${context}: ${String(error)}`;
}
