import { z } from 'zod';

export const BROWSER_TOOLS = {
  LAUNCH: 'browser_launch',
  SCREENSHOT: 'browser_screenshot',
  CLICK: 'browser_click',
  TYPE: 'browser_type',
  SCROLL: 'browser_scroll',
  DRAG: 'browser_drag',
  KEY: 'browser_key',
  NAVIGATE: 'browser_navigate',
  CLOSE: 'browser_close',
  STATUS: 'browser_status',
} as const;

export const LaunchSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  url: z.string().optional(),
  headless: z.boolean().optional().default(true),
  viewportWidth: z.int().optional().default(1440),
  viewportHeight: z.int().optional().default(900),
});

export const ScreenshotSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const ClickSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  x: z.number(),
  y: z.number(),
  button: z.enum(['left', 'right', 'middle']).optional().default('left'),
  clickCount: z.int().optional().default(1),
});

export const TypeSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  text: z.string().min(1, 'Text to type is required'),
});

export const ScrollSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  direction: z.enum(['up', 'down', 'left', 'right']),
  amount: z.int().optional().default(300),
});

export const DragSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  fromX: z.number(),
  fromY: z.number(),
  toX: z.number(),
  toY: z.number(),
});

export const KeySchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  key: z.string().min(1, 'Key is required'),
});

export const NavigateSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  url: z.string().min(1, 'URL is required'),
});

export const CloseSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const StatusSchema = z.object({});

export const BROWSER_SCHEMAS: Record<string, z.ZodType> = {
  [BROWSER_TOOLS.LAUNCH]: LaunchSchema,
  [BROWSER_TOOLS.SCREENSHOT]: ScreenshotSchema,
  [BROWSER_TOOLS.CLICK]: ClickSchema,
  [BROWSER_TOOLS.TYPE]: TypeSchema,
  [BROWSER_TOOLS.SCROLL]: ScrollSchema,
  [BROWSER_TOOLS.DRAG]: DragSchema,
  [BROWSER_TOOLS.KEY]: KeySchema,
  [BROWSER_TOOLS.NAVIGATE]: NavigateSchema,
  [BROWSER_TOOLS.CLOSE]: CloseSchema,
  [BROWSER_TOOLS.STATUS]: StatusSchema,
};

export interface BrowserSession {
  sessionId: string;
  browser: unknown;
  page: unknown;
  createdAt: Date;
}

export interface BrowserStatus {
  available: boolean;
  error: string | null;
  activeSessions: number;
  sessionIds: string[];
}

// Map modifier keys from user-friendly names to Playwright key names
export function normalizeKey(key: string): string {
  const map: Record<string, string> = {
    Ctrl: 'Control',
    Cmd: 'Meta',
    Command: 'Meta',
    Opt: 'Alt',
    Option: 'Alt',
    Del: 'Delete',
    Backspace: 'Backspace',
    Enter: 'Enter',
    Tab: 'Tab',
    Esc: 'Escape',
    Escape: 'Escape',
    Return: 'Enter',
  };
  if (key.includes('+')) {
    return key.split('+').map((part) => map[part.trim()] ?? part.trim()).join('+');
  }
  return map[key] ?? key;
}
