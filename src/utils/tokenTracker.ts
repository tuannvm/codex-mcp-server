import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Token usage information from codex session
 */
export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}

/**
 * Rate limit information
 */
export interface RateLimits {
  primary: {
    usedPercent: number;
    windowMinutes: number;
    resetsAt: number;
  };
  secondary: {
    usedPercent: number;
    windowMinutes: number;
    resetsAt: number;
  };
}

/**
 * Session status with token information
 */
export interface SessionStatus {
  sessionId: string;
  modelContextWindow: number;
  totalTokenUsage: TokenUsage;
  lastTokenUsage: TokenUsage;
  rateLimits: RateLimits;
  contextUsagePercent: number;
  isNearLimit: boolean;
  recommendation: string | null;
}

/**
 * Get codex sessions directory
 */
function getCodexSessionsDir(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.codex', 'sessions');
}

/**
 * Find session file by session ID
 */
export function findSessionFile(sessionId: string): string | null {
  const sessionsDir = getCodexSessionsDir();

  if (!fs.existsSync(sessionsDir)) {
    return null;
  }

  // Search in year/month/day directories
  const years = fs.readdirSync(sessionsDir).filter(f =>
    fs.statSync(path.join(sessionsDir, f)).isDirectory()
  );

  for (const year of years) {
    const yearDir = path.join(sessionsDir, year);
    const months = fs.readdirSync(yearDir).filter(f =>
      fs.statSync(path.join(yearDir, f)).isDirectory()
    );

    for (const month of months) {
      const monthDir = path.join(yearDir, month);
      const days = fs.readdirSync(monthDir).filter(f =>
        fs.statSync(path.join(monthDir, f)).isDirectory()
      );

      for (const day of days) {
        const dayDir = path.join(monthDir, day);
        const files = fs.readdirSync(dayDir).filter(f =>
          f.endsWith('.jsonl') && f.includes(sessionId)
        );

        if (files.length > 0) {
          return path.join(dayDir, files[0]);
        }
      }
    }
  }

  return null;
}

/**
 * Find most recent session file
 */
export function findMostRecentSession(): { sessionId: string; filePath: string } | null {
  const sessionsDir = getCodexSessionsDir();

  if (!fs.existsSync(sessionsDir)) {
    return null;
  }

  let mostRecent: { sessionId: string; filePath: string; mtime: number } | null = null;

  const years = fs.readdirSync(sessionsDir)
    .filter(f => fs.statSync(path.join(sessionsDir, f)).isDirectory())
    .sort()
    .reverse();

  for (const year of years) {
    const yearDir = path.join(sessionsDir, year);
    const months = fs.readdirSync(yearDir)
      .filter(f => fs.statSync(path.join(yearDir, f)).isDirectory())
      .sort()
      .reverse();

    for (const month of months) {
      const monthDir = path.join(yearDir, month);
      const days = fs.readdirSync(monthDir)
        .filter(f => fs.statSync(path.join(monthDir, f)).isDirectory())
        .sort()
        .reverse();

      for (const day of days) {
        const dayDir = path.join(monthDir, day);
        const files = fs.readdirSync(dayDir)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => ({
            name: f,
            path: path.join(dayDir, f),
            mtime: fs.statSync(path.join(dayDir, f)).mtimeMs
          }))
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0 && (!mostRecent || files[0].mtime > mostRecent.mtime)) {
          // Extract session ID (UUID) from filename: rollout-YYYY-MM-DDTHH-MM-SS-<uuid>.jsonl
          // UUID format: 8-4-4-4-12 hex chars (e.g., 019b1535-3921-7280-98d2-62083dc27742)
          const match = files[0].name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
          if (match) {
            mostRecent = {
              sessionId: match[1],
              filePath: files[0].path,
              mtime: files[0].mtime
            };
          }
        }
      }

      if (mostRecent) break;
    }

    if (mostRecent) break;
  }

  return mostRecent ? { sessionId: mostRecent.sessionId, filePath: mostRecent.filePath } : null;
}

/**
 * Parse token_count event from session file
 */
export function getSessionStatus(sessionIdOrPath: string): SessionStatus | null {
  let filePath: string | null;
  let sessionId: string;

  // Check if it's a file path or session ID
  if (sessionIdOrPath.includes('/') || sessionIdOrPath.includes('\\')) {
    filePath = sessionIdOrPath;
    const match = path.basename(filePath).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
    sessionId = match ? match[1] : 'unknown';
  } else {
    sessionId = sessionIdOrPath;
    filePath = findSessionFile(sessionId);
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  // Read file and find last token_count event
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').reverse();

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === 'event_msg' && event.payload?.type === 'token_count') {
        const info = event.payload.info;
        // Skip if info is null (happens in short sessions)
        if (!info || !info.total_token_usage) {
          continue;
        }
        const totalUsage = info.total_token_usage;
        const lastUsage = info.last_token_usage;
        const contextWindow = info.model_context_window;
        // rate_limits is at payload level, not inside info
        const rateLimits = event.payload.rate_limits;

        // Skip if rate_limits structure is invalid
        if (!rateLimits?.primary || !rateLimits?.secondary) {
          continue;
        }

        // Calculate context usage percentage
        // Note: input_tokens can exceed context_window due to caching
        const contextUsagePercent = (totalUsage.input_tokens / contextWindow) * 100;
        const isNearLimit = contextUsagePercent > 80;

        let recommendation: string | null = null;
        if (contextUsagePercent > 90) {
          recommendation = 'CRITICAL: Context window almost full. Reset session immediately.';
        } else if (contextUsagePercent > 80) {
          recommendation = 'WARNING: Context window is getting full. Consider resetting session soon.';
        } else if (contextUsagePercent > 60) {
          recommendation = 'INFO: Context usage is moderate. Monitor usage.';
        }

        return {
          sessionId,
          modelContextWindow: contextWindow,
          totalTokenUsage: {
            inputTokens: totalUsage.input_tokens,
            cachedInputTokens: totalUsage.cached_input_tokens,
            outputTokens: totalUsage.output_tokens,
            reasoningOutputTokens: totalUsage.reasoning_output_tokens || 0,
            totalTokens: totalUsage.total_tokens,
          },
          lastTokenUsage: {
            inputTokens: lastUsage.input_tokens,
            cachedInputTokens: lastUsage.cached_input_tokens,
            outputTokens: lastUsage.output_tokens,
            reasoningOutputTokens: lastUsage.reasoning_output_tokens || 0,
            totalTokens: lastUsage.total_tokens,
          },
          rateLimits: {
            primary: {
              usedPercent: rateLimits.primary.used_percent,
              windowMinutes: rateLimits.primary.window_minutes,
              resetsAt: rateLimits.primary.resets_at,
            },
            secondary: {
              usedPercent: rateLimits.secondary.used_percent,
              windowMinutes: rateLimits.secondary.window_minutes,
              resetsAt: rateLimits.secondary.resets_at,
            },
          },
          contextUsagePercent,
          isNearLimit,
          recommendation,
        };
      }
    } catch {
      // Skip invalid JSON lines
      continue;
    }
  }

  return null;
}

/**
 * Format session status for display
 */
export function formatSessionStatus(status: SessionStatus): string {
  const lines = [
    `Session ID: ${status.sessionId}`,
    ``,
    `Context Window: ${status.modelContextWindow.toLocaleString()} tokens`,
    `Context Usage: ${status.contextUsagePercent.toFixed(1)}%`,
    ``,
    `Total Token Usage:`,
    `  Input: ${status.totalTokenUsage.inputTokens.toLocaleString()}`,
    `  Cached: ${status.totalTokenUsage.cachedInputTokens.toLocaleString()}`,
    `  Output: ${status.totalTokenUsage.outputTokens.toLocaleString()}`,
    `  Total: ${status.totalTokenUsage.totalTokens.toLocaleString()}`,
    ``,
    `Rate Limits:`,
    `  Primary (5h): ${status.rateLimits.primary.usedPercent}% used`,
    `  Secondary (7d): ${status.rateLimits.secondary.usedPercent}% used`,
  ];

  if (status.recommendation) {
    lines.push('', status.recommendation);
  }

  return lines.join('\n');
}
