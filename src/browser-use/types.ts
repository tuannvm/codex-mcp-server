import { z } from 'zod';

// Per-action schemas (separate for validation reuse and clean errors)
const openSchema = z.object({
  action: z.literal('open'),
  sessionId: z.string().min(1, 'Session ID is required'),
  url: z.string().optional(),
  headless: z.boolean().optional().default(true),
  viewportWidth: z.int().optional().default(1440),
  viewportHeight: z.int().optional().default(900),
});

const navigateSchema = z.object({
  action: z.literal('navigate'),
  sessionId: z.string().min(1, 'Session ID is required'),
  url: z.string().min(1, 'URL is required'),
});

const screenshotSchema = z.object({
  action: z.literal('screenshot'),
  sessionId: z.string().min(1, 'Session ID is required'),
});

const clickSchema = z.object({
  action: z.literal('click'),
  sessionId: z.string().min(1, 'Session ID is required'),
  x: z.number(),
  y: z.number(),
  button: z.enum(['left', 'right', 'middle']).optional().default('left'),
  clickCount: z.int().optional().default(1),
});

const typeSchema = z.object({
  action: z.literal('type'),
  sessionId: z.string().min(1, 'Session ID is required'),
  text: z.string().min(1, 'Text to type is required'),
});

const keySchema = z.object({
  action: z.literal('key'),
  sessionId: z.string().min(1, 'Session ID is required'),
  key: z.string().min(1, 'Key is required'),
});

const scrollSchema = z.object({
  action: z.literal('scroll'),
  sessionId: z.string().min(1, 'Session ID is required'),
  direction: z.enum(['up', 'down', 'left', 'right']),
  amount: z.int().optional().default(300),
});

const dragSchema = z.object({
  action: z.literal('drag'),
  sessionId: z.string().min(1, 'Session ID is required'),
  fromX: z.number(),
  fromY: z.number(),
  toX: z.number(),
  toY: z.number(),
});

const closeSchema = z.object({
  action: z.literal('close'),
  sessionId: z.string().min(1, 'Session ID is required'),
});

const statusSchema = z.object({
  action: z.literal('status'),
});

// Discriminated union for single-parse validation
export const BrowserActionSchema = z.discriminatedUnion('action', [
  openSchema, navigateSchema, screenshotSchema, clickSchema,
  typeSchema, keySchema, scrollSchema, dragSchema,
  closeSchema, statusSchema,
]);

// Map action to its schema for per-action validation (fixes #3: clean error messages)
const ACTION_SCHEMAS: Record<string, z.ZodType> = {
  open: openSchema,
  navigate: navigateSchema,
  screenshot: screenshotSchema,
  click: clickSchema,
  type: typeSchema,
  key: keySchema,
  scroll: scrollSchema,
  drag: dragSchema,
  close: closeSchema,
  status: statusSchema,
};

export type BrowserAction = z.infer<typeof BrowserActionSchema>;

export function parseBrowserAction(args: unknown): BrowserAction {
  const raw = args as Record<string, unknown>;
  const action = typeof raw.action === 'string' ? raw.action : undefined;

  // Per-action validation for clean error messages
  if (action && ACTION_SCHEMAS[action]) {
    return ACTION_SCHEMAS[action].parse(args) as BrowserAction;
  }

  // Fallback: full discriminated union parse (handles missing/invalid action)
  return BrowserActionSchema.parse(args) as BrowserAction;
}

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
