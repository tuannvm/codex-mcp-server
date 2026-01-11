export class ToolExecutionError extends Error {
  constructor(
    public readonly toolName: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`Failed to execute tool "${toolName}": ${message}`);
    this.name = 'ToolExecutionError';
  }
}

export class CommandExecutionError extends Error {
  constructor(
    public readonly command: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`Command execution failed for "${command}": ${message}`);
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
    const messages: string[] = [error.message];

    // Traverse the cause chain to get root cause details
    let current: unknown = error.cause;
    while (current) {
      if (current instanceof Error) {
        messages.push(current.message);
        current = current.cause;
      } else if (typeof current === 'string') {
        messages.push(current);
        break;
      } else {
        messages.push(String(current));
        break;
      }
    }

    // Deduplicate consecutive identical messages
    const uniqueMessages = messages.filter(
      (msg, idx) => idx === 0 || msg !== messages[idx - 1]
    );

    return `Error in ${context}: ${uniqueMessages.join(' - Caused by: ')}`;
  }
  return `Error in ${context}: ${String(error)}`;
}
