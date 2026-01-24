import {
  TOOLS,
  type ToolResult,
  type ToolHandlerContext,
  type CodexToolArgs,
  type ReviewToolArgs,
  type PingToolArgs,
  CodexToolSchema,
  ReviewToolSchema,
  PingToolSchema,
  HelpToolSchema,
  ListSessionsToolSchema,
} from '../types.js';
import {
  InMemorySessionStorage,
  type SessionStorage,
  type ConversationTurn,
} from '../session/storage.js';
import { ToolExecutionError, ValidationError } from '../errors.js';
import { executeCommand, executeCommandStreaming } from '../utils/command.js';
import { ZodError } from 'zod';

// Default no-op context for handlers that don't need progress
const defaultContext: ToolHandlerContext = {
  sendProgress: async () => {},
};

export class CodexToolHandler {
  constructor(private sessionStorage: SessionStorage) {}

  async execute(
    args: unknown,
    context: ToolHandlerContext = defaultContext
  ): Promise<ToolResult> {
    try {
      const {
        prompt,
        sessionId,
        resetSession,
        model,
        reasoningEffort,
        sandbox,
        fullAuto,
        workingDirectory,
        callbackUri,
      }: CodexToolArgs = CodexToolSchema.parse(args);

      let activeSessionId = sessionId;
      let enhancedPrompt = prompt;

      // Only work with sessions if explicitly requested
      let useResume = false;
      let codexConversationId: string | undefined;

      if (sessionId) {
        this.sessionStorage.ensureSession(sessionId);
        if (resetSession) {
          this.sessionStorage.resetSession(sessionId);
        }

        codexConversationId =
          this.sessionStorage.getCodexConversationId(sessionId);
        if (codexConversationId) {
          useResume = true;
        } else {
          // Fallback to manual context building if no codex conversation ID
          const session = this.sessionStorage.getSession(sessionId);
          if (
            session &&
            Array.isArray(session.turns) &&
            session.turns.length > 0
          ) {
            enhancedPrompt = this.buildEnhancedPrompt(session.turns, prompt);
          }
        }
      }

      // Build command arguments with v0.75.0+ features
      const selectedModel =
        model || process.env.CODEX_DEFAULT_MODEL || 'gpt-5.2-codex'; // Default to gpt-5.2-codex

      const effectiveCallbackUri =
        callbackUri || process.env.CODEX_MCP_CALLBACK_URI;

      let cmdArgs: string[];

      if (useResume && codexConversationId) {
        // Resume mode: codex exec resume has limited flags
        // All exec options (--skip-git-repo-check, -c) must come BEFORE 'resume' subcommand
        cmdArgs = ['exec', '--skip-git-repo-check'];

        // Model must be set via -c config in resume mode (before subcommand)
        cmdArgs.push('-c', `model="${selectedModel}"`);

        // Reasoning effort via config (before subcommand)
        if (reasoningEffort) {
          cmdArgs.push('-c', `model_reasoning_effort="${reasoningEffort}"`);
        }

        // Add resume subcommand with conversation ID and prompt
        cmdArgs.push('resume', codexConversationId, enhancedPrompt);
      } else {
        // Exec mode: supports full set of flags
        cmdArgs = ['exec'];

        // Add model parameter
        cmdArgs.push('--model', selectedModel);

        // Add reasoning effort via config parameter (quoted for consistency)
        if (reasoningEffort) {
          cmdArgs.push('-c', `model_reasoning_effort="${reasoningEffort}"`);
        }

        // Add sandbox mode (v0.75.0+)
        if (sandbox) {
          cmdArgs.push('--sandbox', sandbox);
        }

        // Add full-auto mode (v0.75.0+)
        if (fullAuto) {
          cmdArgs.push('--full-auto');
        }

        // Add working directory (v0.75.0+)
        if (workingDirectory) {
          cmdArgs.push('-C', workingDirectory);
        }

        // Skip git repo check for v0.50.0+
        cmdArgs.push('--skip-git-repo-check');

        cmdArgs.push(enhancedPrompt);
      }

      // Send initial progress notification
      await context.sendProgress('Starting Codex execution...', 0);

      // Use streaming execution if progress is enabled
      const useStreaming = !!context.progressToken;
      const envOverride = effectiveCallbackUri
        ? { CODEX_MCP_CALLBACK_URI: effectiveCallbackUri }
        : undefined;

      const result = useStreaming
        ? await executeCommandStreaming('codex', cmdArgs, {
            onProgress: (message) => {
              // Send progress notification for each chunk of output
              context.sendProgress(message);
            },
            envOverride,
          })
        : envOverride
          ? await executeCommand('codex', cmdArgs, envOverride)
          : await executeCommand('codex', cmdArgs);

      // Codex CLI may output to stderr, so check both
      const response = result.stdout || result.stderr || 'No output from Codex';

      // Extract session ID from new conversations for future resume
      // Note: Codex v0.75.0 uses "session id:" format
      if (activeSessionId && !useResume) {
        const conversationIdMatch = result.stderr?.match(
          /session\s*id\s*:\s*([a-zA-Z0-9-]+)/i
        );
        if (conversationIdMatch) {
          this.sessionStorage.setCodexConversationId(
            activeSessionId,
            conversationIdMatch[1]
          );
        }
      }

      const combinedOutput = `${result.stderr || ''}
${result.stdout || ''}`.trim();
      const threadIdMatch = combinedOutput.match(
        /thread\s*id\s*:\s*([a-zA-Z0-9_-]+)/i
      );
      const threadId = threadIdMatch ? threadIdMatch[1] : undefined;

      // Save turn only if using a session
      if (activeSessionId) {
        const turn: ConversationTurn = {
          prompt,
          response,
          timestamp: new Date(),
        };
        this.sessionStorage.addTurn(activeSessionId, turn);
      }

      // Prepare metadata for dual approach:
      // - content[0]._meta: For Claude Code compatibility (avoids structuredContent bug)
      // - structuredContent: For other MCP clients that properly support it
      const metadata: Record<string, unknown> = {
        ...(threadId && { threadId }),
        ...(selectedModel && { model: selectedModel }),
        ...(activeSessionId && { sessionId: activeSessionId }),
        ...(effectiveCallbackUri && { callbackUri: effectiveCallbackUri }),
      };

      return {
        content: [
          {
            type: 'text',
            text: response,
            _meta: metadata,
          },
        ],
        structuredContent:
          Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.CODEX, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.CODEX,
        'Failed to execute codex command',
        error
      );
    }
  }

  private buildEnhancedPrompt(
    turns: ConversationTurn[],
    newPrompt: string
  ): string {
    if (turns.length === 0) return newPrompt;

    // Get relevant context from recent turns
    const recentTurns = turns.slice(-2);
    const contextualInfo = recentTurns
      .map((turn) => {
        // Extract key information without conversational format
        if (
          turn.response.includes('function') ||
          turn.response.includes('def ')
        ) {
          return `Previous code context: ${turn.response.slice(0, 200)}...`;
        }
        return `Context: ${turn.prompt} -> ${turn.response.slice(0, 100)}...`;
      })
      .join('\n');

    // Build enhanced prompt that provides context without conversation format
    return `${contextualInfo}\n\nTask: ${newPrompt}`;
  }
}

export class PingToolHandler {
  async execute(
    args: unknown,
    _context: ToolHandlerContext = defaultContext
  ): Promise<ToolResult> {
    try {
      const { message = 'pong' }: PingToolArgs = PingToolSchema.parse(args);

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.PING, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.PING,
        'Failed to execute ping command',
        error
      );
    }
  }
}

export class HelpToolHandler {
  async execute(
    args: unknown,
    _context: ToolHandlerContext = defaultContext
  ): Promise<ToolResult> {
    try {
      HelpToolSchema.parse(args);

      const result = await executeCommand('codex', ['--help']);

      return {
        content: [
          {
            type: 'text',
            text: result.stdout || 'No help information available',
          },
        ],
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.HELP, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.HELP,
        'Failed to execute help command',
        error
      );
    }
  }
}

export class ListSessionsToolHandler {
  constructor(private sessionStorage: SessionStorage) {}

  async execute(
    args: unknown,
    _context: ToolHandlerContext = defaultContext
  ): Promise<ToolResult> {
    try {
      ListSessionsToolSchema.parse(args);

      const sessions = this.sessionStorage.listSessions();
      const sessionInfo = sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        lastAccessedAt: session.lastAccessedAt.toISOString(),
        turnCount: session.turns.length,
      }));

      return {
        content: [
          {
            type: 'text',
            text:
              sessionInfo.length > 0
                ? JSON.stringify(sessionInfo, null, 2)
                : 'No active sessions',
          },
        ],
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.LIST_SESSIONS, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.LIST_SESSIONS,
        'Failed to list sessions',
        error
      );
    }
  }
}

export class ReviewToolHandler {
  async execute(
    args: unknown,
    context: ToolHandlerContext = defaultContext
  ): Promise<ToolResult> {
    try {
      const {
        prompt,
        uncommitted,
        base,
        commit,
        title,
        model,
        workingDirectory,
      }: ReviewToolArgs = ReviewToolSchema.parse(args);

      if (prompt && uncommitted) {
        throw new ValidationError(
          TOOLS.REVIEW,
          'The review prompt cannot be combined with uncommitted=true. Use a base/commit review or omit the prompt.'
        );
      }

      // Build command arguments for codex exec review
      // All exec options (-C, --skip-git-repo-check, -c) must come BEFORE 'review' subcommand
      const cmdArgs = ['exec', '--skip-git-repo-check'];

      // Add model parameter via config
      const selectedModel =
        model || process.env.CODEX_DEFAULT_MODEL || 'gpt-5.2-codex';
      cmdArgs.push('-c', `model="${selectedModel}"`);

      // Add working directory if specified
      if (workingDirectory) {
        cmdArgs.push('-C', workingDirectory);
      }

      // Add review-specific flags
      if (uncommitted) {
        cmdArgs.push('--uncommitted');
      }

      if (base) {
        cmdArgs.push('--base', base);
      }

      if (commit) {
        cmdArgs.push('--commit', commit);
      }

      if (title) {
        cmdArgs.push('--title', title);
      }

      // Add custom review instructions if provided
      if (prompt) {
        cmdArgs.push(prompt);
      }

      // Send initial progress notification
      await context.sendProgress('Starting code review...', 0);

      // Use streaming execution if progress is enabled
      const useStreaming = !!context.progressToken;
      const result = useStreaming
        ? await executeCommandStreaming('codex', cmdArgs, {
            onProgress: (message) => {
              context.sendProgress(message);
            },
          })
        : await executeCommand('codex', cmdArgs);

      // Codex CLI outputs to stderr, so check both stdout and stderr
      const response =
        result.stdout || result.stderr || 'No review output from Codex';

      // Prepare metadata for dual approach:
      // - content[0]._meta: For Claude Code compatibility (avoids structuredContent bug)
      // - structuredContent: For other MCP clients that properly support it
      const metadata: Record<string, unknown> = {
        model: selectedModel,
        ...(base && { base }),
        ...(commit && { commit }),
      };

      return {
        content: [
          {
            type: 'text',
            text: response,
            _meta: metadata,
          },
        ],
        structuredContent: metadata,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.REVIEW, error.message);
      }
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ToolExecutionError(
        TOOLS.REVIEW,
        'Failed to execute code review',
        error
      );
    }
  }
}

// Tool handler registry
const sessionStorage = new InMemorySessionStorage();

export const toolHandlers = {
  [TOOLS.CODEX]: new CodexToolHandler(sessionStorage),
  [TOOLS.REVIEW]: new ReviewToolHandler(),
  [TOOLS.PING]: new PingToolHandler(),
  [TOOLS.HELP]: new HelpToolHandler(),
  [TOOLS.LIST_SESSIONS]: new ListSessionsToolHandler(sessionStorage),
} as const;
