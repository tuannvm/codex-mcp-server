import {
  TOOLS,
  type ToolResult,
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
import { executeCommand } from '../utils/command.js';
import { ZodError } from 'zod';

export class CodexToolHandler {
  constructor(private sessionStorage: SessionStorage) {}

  async execute(args: unknown): Promise<ToolResult> {
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
      }: CodexToolArgs = CodexToolSchema.parse(args);

      let activeSessionId = sessionId;
      let enhancedPrompt = prompt;

      // Only work with sessions if explicitly requested
      let useResume = false;
      let codexConversationId: string | undefined;

      if (sessionId) {
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

      let cmdArgs: string[];

      if (useResume && codexConversationId) {
        // Resume mode: codex exec resume has limited flags (only -c config)
        cmdArgs = ['exec', 'resume', codexConversationId];

        // Model must be set via -c config in resume mode
        cmdArgs.push('-c', `model="${selectedModel}"`);

        // Reasoning effort via config (quoted for consistency)
        if (reasoningEffort) {
          cmdArgs.push('-c', `model_reasoning_effort="${reasoningEffort}"`);
        }

        // Add prompt at the end
        cmdArgs.push(enhancedPrompt);
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

      const result = await executeCommand('codex', cmdArgs);
      const response = result.stdout || 'No output from Codex';

      // Extract conversation ID from new conversations for future resume
      if (activeSessionId && !useResume) {
        const conversationIdMatch = result.stderr?.match(
          /conversation\s*id\s*:\s*([a-zA-Z0-9-]+)/i
        );
        if (conversationIdMatch) {
          this.sessionStorage.setCodexConversationId(
            activeSessionId,
            conversationIdMatch[1]
          );
        }
      }

      // Save turn only if using a session
      if (activeSessionId) {
        const turn: ConversationTurn = {
          prompt,
          response,
          timestamp: new Date(),
        };
        this.sessionStorage.addTurn(activeSessionId, turn);
      }

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
        _meta: {
          ...(activeSessionId && { sessionId: activeSessionId }),
          model: selectedModel,
        },
      };
    } catch (error) {
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
  async execute(args: unknown): Promise<ToolResult> {
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
  async execute(args: unknown): Promise<ToolResult> {
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

  async execute(args: unknown): Promise<ToolResult> {
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
  async execute(args: unknown): Promise<ToolResult> {
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

      // Build command arguments for codex exec review
      // Note: -C flag belongs to 'exec', must come BEFORE 'review' subcommand
      const cmdArgs = ['exec'];

      // Add working directory if specified (must be before subcommand)
      if (workingDirectory) {
        cmdArgs.push('-C', workingDirectory);
      }

      // Add the review subcommand
      cmdArgs.push('review');

      // Add model parameter if specified (via -c config)
      if (model) {
        cmdArgs.push('-c', `model="${model}"`);
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

      const result = await executeCommand('codex', cmdArgs);
      const response = result.stdout || 'No review output from Codex';

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
        _meta: {
          ...(model && { model }),
          ...(base && { base }),
          ...(commit && { commit }),
        },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.REVIEW, error.message);
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
