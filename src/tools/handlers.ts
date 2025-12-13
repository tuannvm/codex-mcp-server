import {
  TOOLS,
  type ToolResult,
  type CodexToolArgs,
  type PingToolArgs,
  type GetSessionStatusToolArgs,
  CodexToolSchema,
  PingToolSchema,
  HelpToolSchema,
  ListSessionsToolSchema,
  GetSessionStatusToolSchema,
} from '../types.js';
import {
  InMemorySessionStorage,
  type SessionStorage,
  type ConversationTurn,
} from '../session/storage.js';
import { ToolExecutionError, ValidationError } from '../errors.js';
import { executeCommand } from '../utils/command.js';
import {
  getSessionStatus,
  findMostRecentSession,
  formatSessionStatus,
} from '../utils/tokenTracker.js';
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

        // Ensure session exists (create if not)
        let session = this.sessionStorage.getSession(sessionId);
        if (!session) {
          this.sessionStorage.createSessionWithId(sessionId);
        }

        codexConversationId =
          this.sessionStorage.getCodexConversationId(sessionId);
        if (codexConversationId) {
          useResume = true;
        } else {
          // Fallback to manual context building if no codex conversation ID
          session = this.sessionStorage.getSession(sessionId);
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

      // Add model parameter (supported in both exec and resume)
      const selectedModel =
        model || process.env.CODEX_DEFAULT_MODEL || 'gpt-5.1-codex-max'; // Default to gpt-5.1-codex-max
      cmdArgs.push('--model', selectedModel);

      // Add reasoning effort via config parameter (v0.50.0+ uses -c instead of --reasoning-effort)
      if (reasoningEffort) {
        cmdArgs.push('-c', `model_reasoning_effort=${reasoningEffort}`);
      }

      // Skip git repo check for v0.50.0+
      cmdArgs.push('--skip-git-repo-check');

      // stdin으로 prompt 전달하기 위해 '-' 추가
      cmdArgs.push('-');

      const result = await executeCommand('codex', cmdArgs, enhancedPrompt);
      const response = result.stdout || 'No output from Codex';

      // Extract session ID from new sessions for future resume
      if (activeSessionId && !useResume) {
        const sessionIdMatch = result.stderr?.match(
          /session\s*id\s*:\s*([a-zA-Z0-9-]+)/i
        );
        if (sessionIdMatch) {
          this.sessionStorage.setCodexConversationId(
            activeSessionId,
            sessionIdMatch[1]
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

export class GetSessionStatusHandler {
  constructor(private sessionStorage: SessionStorage) {}

  async execute(args: unknown): Promise<ToolResult> {
    try {
      const { sessionId }: GetSessionStatusToolArgs =
        GetSessionStatusToolSchema.parse(args);

      let targetSessionId: string | undefined = sessionId;
      let sessionFilePath: string | undefined;
      let codexSessionId: string | undefined;

      // If session ID provided, check if it's an MCP session ID that maps to a Codex CLI session
      if (targetSessionId) {
        // Check if it's a UUID format (Codex CLI session ID)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetSessionId);

        if (!isUUID) {
          // It's an MCP session ID, look up the mapped Codex CLI session ID
          codexSessionId = this.sessionStorage.getCodexConversationId(targetSessionId);
          if (codexSessionId) {
            targetSessionId = codexSessionId;
          }
        }
      }

      // If no session ID provided, find most recent session
      if (!targetSessionId) {
        const recentSession = findMostRecentSession();
        if (recentSession) {
          targetSessionId = recentSession.sessionId;
          sessionFilePath = recentSession.filePath;
        }
      }

      if (!targetSessionId) {
        return {
          content: [
            {
              type: 'text',
              text: 'No Codex sessions found.',
            },
          ],
        };
      }

      const status = getSessionStatus(sessionFilePath || targetSessionId);

      if (!status) {
        return {
          content: [
            {
              type: 'text',
              text: `Could not find token information for session: ${targetSessionId}`,
            },
          ],
        };
      }

      const formattedStatus = formatSessionStatus(status);

      return {
        content: [
          {
            type: 'text',
            text: formattedStatus,
          },
        ],
        _meta: {
          sessionId: status.sessionId,
          contextUsagePercent: status.contextUsagePercent,
          isNearLimit: status.isNearLimit,
          modelContextWindow: status.modelContextWindow,
          totalInputTokens: status.totalTokenUsage.inputTokens,
        },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.GET_SESSION_STATUS, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.GET_SESSION_STATUS,
        'Failed to get session status',
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
  [TOOLS.GET_SESSION_STATUS]: new GetSessionStatusHandler(sessionStorage),
} as const;
