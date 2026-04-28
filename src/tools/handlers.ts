import {
  TOOLS,
  DEFAULT_CODEX_MODEL,
  CODEX_DEFAULT_MODEL_ENV_VAR,
  type ToolName,
  type ToolResult,
  type ToolHandlerContext,
  type CodexToolArgs,
  type ReviewToolArgs,
  type PingToolArgs,
  type WebSearchToolArgs,
  type CommandResult,
  CodexToolSchema,
  ReviewToolSchema,
  PingToolSchema,
  HelpToolSchema,
  ListSessionsToolSchema,
  WebSearchToolSchema,
} from '../types.js';
import {
  InMemorySessionStorage,
  type SessionStorage,
  type ConversationTurn,
} from '../session/storage.js';
import { ToolExecutionError, ValidationError } from '../errors.js';
import {
  executeCommand,
  executeCommandStreaming,
  type CommandOptions,
} from '../utils/command.js';
import { ZodError } from 'zod';
import path from 'node:path';

interface ToolHandler {
  execute(args: unknown, context?: ToolHandlerContext): Promise<ToolResult>;
}

const defaultContext: ToolHandlerContext = {
  sendProgress: async () => {},
};

const STRUCTURED_CONTENT_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  (process.env.STRUCTURED_CONTENT_ENABLED ?? '').toLowerCase()
);

function getToolContext(context?: ToolHandlerContext): ToolHandlerContext {
  return context ?? defaultContext;
}

function getSelectedModel(model?: string): string {
  return (
    model || process.env[CODEX_DEFAULT_MODEL_ENV_VAR] || DEFAULT_CODEX_MODEL
  );
}

function getCommandResponse(result: CommandResult, fallback: string): string {
  return result.stdout || result.stderr || fallback;
}

class CommandBackedToolHandler {
  protected readonly structuredContentEnabled = STRUCTURED_CONTENT_ENABLED;

  protected async executeCodexCommand(
    cmdArgs: string[],
    context: ToolHandlerContext,
    options?: CommandOptions
  ): Promise<CommandResult> {
    const commandOptions = {
      ...options,
      signal: options?.signal ?? context.abortSignal,
    };

    if (context.progressToken) {
      return executeCommandStreaming('codex', cmdArgs, {
        ...commandOptions,
        onProgress: (message) => {
          void context.sendProgress(message);
        },
      });
    }

    return executeCommand('codex', cmdArgs, commandOptions);
  }

  protected createTextResult(
    text: string,
    metadata?: Record<string, unknown>
  ): ToolResult {
    const hasMetadata = !!metadata && Object.keys(metadata).length > 0;

    return {
      content: [
        {
          type: 'text',
          text,
          ...(hasMetadata ? { _meta: metadata } : {}),
        },
      ],
      structuredContent:
        this.structuredContentEnabled && hasMetadata ? metadata : undefined,
    };
  }
}

export class CodexToolHandler extends CommandBackedToolHandler {
  constructor(private sessionStorage: SessionStorage) {
    super();
  }

  async execute(
    args: unknown,
    context?: ToolHandlerContext
  ): Promise<ToolResult> {
    try {
      const toolContext = getToolContext(context);
      const {
        prompt,
        sessionId,
        resetSession,
        model,
        reasoningEffort,
        sandbox,
        fullAuto,
        bypassApprovals,
        workingDirectory,
        callbackUri,
      }: CodexToolArgs = CodexToolSchema.parse(args);

      // Resolve to absolute path once so -C and spawn cwd agree
      const resolvedWorkDir = workingDirectory
        ? path.resolve(workingDirectory)
        : undefined;

      const activeSessionId = sessionId;
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
      const selectedModel = getSelectedModel(model);

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

        if (fullAuto) {
          cmdArgs.push('--full-auto');
        }

        // Bypass all approval prompts and sandboxing — use only in externally sandboxed envs
        if (bypassApprovals) {
          cmdArgs.push('--dangerously-bypass-approvals-and-sandbox');
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

        // Bypass all approval prompts and sandboxing — use only in externally sandboxed envs
        if (bypassApprovals) {
          cmdArgs.push('--dangerously-bypass-approvals-and-sandbox');
        }

        // Add working directory (v0.75.0+)
        if (resolvedWorkDir) {
          cmdArgs.push('-C', resolvedWorkDir);
        }

        // Skip git repo check for v0.50.0+
        cmdArgs.push('--skip-git-repo-check');

        cmdArgs.push(enhancedPrompt);
      }

      // Send initial progress notification
      await toolContext.sendProgress('Starting Codex execution...', 0);
      const envOverride = effectiveCallbackUri
        ? { CODEX_MCP_CALLBACK_URI: effectiveCallbackUri }
        : undefined;

      // Pass cwd to spawn so the child process starts in the correct directory.
      // This works around openai/codex#9084 where -C is ignored by some subcommands.
      // Skip cwd during resume: sandbox and workingDirectory are not applied in
      // resume mode (Codex CLI limitation).
      const cmdOptions = {
        cwd: useResume ? undefined : resolvedWorkDir,
        envOverride,
        signal: toolContext.abortSignal,
      };

      const result = await this.executeCodexCommand(
        cmdArgs,
        toolContext,
        cmdOptions
      );

      // Codex CLI may output to stderr, so check both
      const response = getCommandResponse(result, 'No output from Codex');

      // Extract conversation/session ID from new conversations for future resume
      // Codex CLI outputs have varied between "session id" and "conversation id"
      if (activeSessionId && !useResume) {
        const conversationIdMatch = result.stderr?.match(
          /(conversation|session)\s*id\s*:\s*([a-zA-Z0-9-]+)/i
        );
        if (conversationIdMatch) {
          this.sessionStorage.setCodexConversationId(
            activeSessionId,
            conversationIdMatch[2]
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
        model: selectedModel,
        ...(activeSessionId && { sessionId: activeSessionId }),
        ...(effectiveCallbackUri && { callbackUri: effectiveCallbackUri }),
        ...(threadId && { threadId }),
      };

      return this.createTextResult(response, metadata);
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

export class HelpToolHandler extends CommandBackedToolHandler {
  async execute(
    args: unknown,
    context?: ToolHandlerContext
  ): Promise<ToolResult> {
    try {
      const toolContext = getToolContext(context);
      HelpToolSchema.parse(args);

      const result = await this.executeCodexCommand(['--help'], toolContext);

      return this.createTextResult(
        getCommandResponse(result, 'No help information available')
      );
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

export class ReviewToolHandler extends CommandBackedToolHandler {
  async execute(
    args: unknown,
    context?: ToolHandlerContext
  ): Promise<ToolResult> {
    try {
      const toolContext = getToolContext(context);
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

      // Resolve to absolute path once so -C and spawn cwd agree
      const resolvedWorkDir = workingDirectory
        ? path.resolve(workingDirectory)
        : undefined;

      // Build command arguments for codex review
      const cmdArgs: string[] = [];

      if (resolvedWorkDir) {
        cmdArgs.push('-C', resolvedWorkDir);
      }

      // Add model parameter via config
      const selectedModel = getSelectedModel(model);
      cmdArgs.push('-c', `model="${selectedModel}"`);

      cmdArgs.push('review');

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
      await toolContext.sendProgress('Starting code review...', 0);
      // Pass cwd to spawn so the child process starts in the correct directory.
      // This works around openai/codex#9084 where -C is ignored by `review`.
      const cmdOptions = { cwd: resolvedWorkDir };
      const result = await this.executeCodexCommand(
        cmdArgs,
        toolContext,
        cmdOptions
      );

      // Codex CLI outputs to stderr, so check both stdout and stderr
      const response = getCommandResponse(
        result,
        'No review output from Codex'
      );

      // Prepare metadata for dual approach:
      // - content[0]._meta: For Claude Code compatibility (avoids structuredContent bug)
      // - structuredContent: For other MCP clients that properly support it
      const metadata: Record<string, unknown> = {
        model: selectedModel,
        ...(base && { base }),
        ...(commit && { commit }),
      };

      return this.createTextResult(response, metadata);
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

/**
 * WebSearchToolHandler - Perform web search via Codex CLI with --search flag
 * Enables Codex's native web_search tool by using --search before exec subcommand
 */
export class WebSearchToolHandler extends CommandBackedToolHandler {
  async execute(
    args: unknown,
    context?: ToolHandlerContext
  ): Promise<ToolResult> {
    try {
      const toolContext = getToolContext(context);
      const {
        query,
        numResults = 10,
        searchDepth = 'basic',
      }: WebSearchToolArgs = WebSearchToolSchema.parse(args);

      // Send initial progress notification
      await toolContext.sendProgress(`Searching for: ${query}...`, 0);

      // Build direct search prompt that leverages the enabled web_search tool
      const searchPrompt = `Search for: ${query}. Provide ${numResults} key findings.${searchDepth === 'full' ? ' Include detailed analysis and context.' : ''}`;

      // Build codex command with --search flag before exec subcommand
      const cmdArgs = [
        '--search',
        'exec',
        '--skip-git-repo-check',
        searchPrompt,
      ];

      const result = await this.executeCodexCommand(cmdArgs, toolContext);

      // Get response from stdout or stderr (Codex may output to either)
      const response = getCommandResponse(
        result,
        'No search output from Codex'
      );

      // Prepare metadata
      const metadata: Record<string, unknown> = {
        query,
        numResults,
        searchDepth,
        timestamp: new Date().toISOString(),
      };

      return this.createTextResult(response, metadata);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.WEBSEARCH, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.WEBSEARCH,
        'Failed to execute web search',
        error
      );
    }
  }
}

// Tool handler registry
const sessionStorage = new InMemorySessionStorage();

export const toolHandlers: Record<ToolName, ToolHandler> = {
  [TOOLS.CODEX]: new CodexToolHandler(sessionStorage),
  [TOOLS.REVIEW]: new ReviewToolHandler(),
  [TOOLS.PING]: new PingToolHandler(),
  [TOOLS.HELP]: new HelpToolHandler(),
  [TOOLS.LIST_SESSIONS]: new ListSessionsToolHandler(sessionStorage),
  [TOOLS.WEBSEARCH]: new WebSearchToolHandler(),
};
