import { TOOLS, type ToolDefinition } from '../types.js';

const browserDef: ToolDefinition = {
  name: TOOLS.BROWSER,
  description:
    'Control a Chromium browser via Playwright. Actions:\n' +
    '• "open" — launch a browser session (required: sessionId; optional: url, headless, viewportWidth, viewportHeight)\n' +
    '• "screenshot" — capture the page as a PNG image, returns base64 data + URL + title (required: sessionId)\n' +
    '• "navigate" — go to a URL in an existing session (required: sessionId, url)\n' +
    '• "click" — click at viewport coordinates (required: sessionId, x, y; optional: button, clickCount)\n' +
    '• "type" — type text into the focused element (required: sessionId, text)\n' +
    '• "key" — press a key or combo like "Enter", "Control+a", "Meta+s" (required: sessionId, key; modifiers auto-normalized)\n' +
    '• "scroll" — scroll the page (required: sessionId, direction; optional: amount in pixels)\n' +
    '• "drag" — drag from one coordinate to another (required: sessionId, fromX, fromY, toX, toY)\n' +
    '• "close" — close a session and free resources (required: sessionId)\n' +
    '• "status" — check if Playwright is available and list active sessions (no params)\n' +
    'You must call "open" before any other action. Use "screenshot" to see the page after navigation or interaction.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['open', 'screenshot', 'navigate', 'click', 'type', 'key', 'scroll', 'drag', 'close', 'status'],
        description: 'The action to perform',
      },
      sessionId: { type: 'string', description: 'Browser session ID (required for all actions except "status")' },
      url: { type: 'string', description: 'URL to open or navigate to (for "open" and "navigate")' },
      headless: { type: 'boolean', description: 'Run without visible window (default: true, for "open")' },
      viewportWidth: { type: 'integer', description: 'Viewport width in pixels (default: 1440, for "open")' },
      viewportHeight: { type: 'integer', description: 'Viewport height in pixels (default: 900, for "open")' },
      x: { type: 'number', description: 'X coordinate in pixels, viewport-relative (for "click")' },
      y: { type: 'number', description: 'Y coordinate in pixels, viewport-relative (for "click")' },
      button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button (default: left, for "click")' },
      clickCount: { type: 'integer', description: 'Number of clicks (default: 1, for "click")' },
      text: { type: 'string', description: 'Text to type into focused element (for "type")' },
      key: { type: 'string', description: 'Key or combo, e.g. "Enter", "Control+a", "Meta+s" (for "key")' },
      direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Scroll direction (for "scroll")' },
      amount: { type: 'integer', description: 'Scroll amount in pixels (default: 300, for "scroll")' },
      fromX: { type: 'number', description: 'Start X coordinate (for "drag")' },
      fromY: { type: 'number', description: 'Start Y coordinate (for "drag")' },
      toX: { type: 'number', description: 'End X coordinate (for "drag")' },
      toY: { type: 'number', description: 'End Y coordinate (for "drag")' },
    },
    required: ['action'],
  },
  annotations: {
    title: 'Browser Control',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const browserUseToolDefinitions: ToolDefinition[] = [browserDef];
