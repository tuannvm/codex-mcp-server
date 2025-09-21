import {
  TOOLS,
  type ToolResult,
  type CodexToolArgs,
  type PingToolArgs,
  CodexToolSchema,
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

      // Build command arguments with new v0.36.0 features
      const cmdArgs =
        useResume && codexConversationId
          ? ['resume', codexConversationId]
          : ['exec'];

      // Add model and reasoning effort parameters (supported in both exec and resume)
      const selectedModel = model || 'gpt-5-codex'; // Default to gpt-5-codex
      cmdArgs.push('--model', selectedModel);
      if (reasoningEffort) {
        cmdArgs.push('--reasoning-effort', reasoningEffort);
      }

      cmdArgs.push(enhancedPrompt);

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
          ...(reasoningEffort && { reasoningEffort }),
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

// Tool handler registry
const sessionStorage = new InMemorySessionStorage();

export const toolHandlers = {
  [TOOLS.CODEX]: new CodexToolHandler(sessionStorage),
  [TOOLS.PING]: new PingToolHandler(),
  [TOOLS.HELP]: new HelpToolHandler(),
  [TOOLS.LIST_SESSIONS]: new ListSessionsToolHandler(sessionStorage),
} as const;
