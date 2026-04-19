import { TOOLS, type ToolDefinition } from '../types.js';
import { BROWSER_TOOLS } from './types.js';

const browserLaunch: ToolDefinition = {
  name: TOOLS.BROWSER_LAUNCH,
  description: 'Launch a new browser session. Returns a sessionId for use with other browser tools. Supports multiple concurrent sessions.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Unique identifier for this browser session' },
      url: { type: 'string', description: 'Optional URL to navigate to on launch' },
      headless: { type: 'boolean', description: 'Run in headless mode (default: true)' },
      viewportWidth: { type: 'integer', description: 'Viewport width in pixels (default: 1440)' },
      viewportHeight: { type: 'integer', description: 'Viewport height in pixels (default: 900)' },
    },
    required: ['sessionId'],
  },
  annotations: { title: 'Launch Browser', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
};

const browserScreenshot: ToolDefinition = {
  name: TOOLS.BROWSER_SCREENSHOT,
  description: 'Take a screenshot of the current browser page. Returns base64 PNG image data along with the page URL and title.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
    },
    required: ['sessionId'],
  },
  annotations: { title: 'Browser Screenshot', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const browserClick: ToolDefinition = {
  name: TOOLS.BROWSER_CLICK,
  description: 'Click at a specific pixel coordinate on the browser page. Coordinates are relative to the viewport.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      x: { type: 'number', description: 'X coordinate in pixels (viewport-relative)' },
      y: { type: 'number', description: 'Y coordinate in pixels (viewport-relative)' },
      button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button (default: left)' },
      clickCount: { type: 'integer', description: 'Number of clicks (default: 1, use 2 for double-click)' },
    },
    required: ['sessionId', 'x', 'y'],
  },
  annotations: { title: 'Browser Click', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

const browserType: ToolDefinition = {
  name: TOOLS.BROWSER_TYPE,
  description: 'Type text into the currently focused element in the browser. Make sure to click on an input field first.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      text: { type: 'string', description: 'Text to type' },
    },
    required: ['sessionId', 'text'],
  },
  annotations: { title: 'Browser Type', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

const browserScroll: ToolDefinition = {
  name: TOOLS.BROWSER_SCROLL,
  description: 'Scroll the browser page in a given direction by a specified pixel amount.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Scroll direction' },
      amount: { type: 'integer', description: 'Scroll amount in pixels (default: 300)' },
    },
    required: ['sessionId', 'direction'],
  },
  annotations: { title: 'Browser Scroll', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

const browserDrag: ToolDefinition = {
  name: TOOLS.BROWSER_DRAG,
  description: 'Drag from one pixel coordinate to another on the browser page. Coordinates are viewport-relative.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      fromX: { type: 'number', description: 'Start X coordinate' },
      fromY: { type: 'number', description: 'Start Y coordinate' },
      toX: { type: 'number', description: 'End X coordinate' },
      toY: { type: 'number', description: 'End Y coordinate' },
    },
    required: ['sessionId', 'fromX', 'fromY', 'toX', 'toY'],
  },
  annotations: { title: 'Browser Drag', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

const browserKey: ToolDefinition = {
  name: TOOLS.BROWSER_KEY,
  description: 'Press a key or key combination in the browser. Supports Playwright key names (e.g., "Enter", "Control+a", "Meta+s").',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      key: { type: 'string', description: 'Key or key combination to press' },
    },
    required: ['sessionId', 'key'],
  },
  annotations: { title: 'Browser Key Press', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

const browserNavigate: ToolDefinition = {
  name: TOOLS.BROWSER_NAVIGATE,
  description: 'Navigate the browser to a URL.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      url: { type: 'string', description: 'URL to navigate to' },
    },
    required: ['sessionId', 'url'],
  },
  annotations: { title: 'Browser Navigate', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
};

const browserClose: ToolDefinition = {
  name: TOOLS.BROWSER_CLOSE,
  description: 'Close a browser session and clean up resources.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID to close' },
    },
    required: ['sessionId'],
  },
  annotations: { title: 'Close Browser', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
};

const browserStatus: ToolDefinition = {
  name: TOOLS.BROWSER_STATUS,
  description: 'Check browser automation status. Returns whether Playwright is available and lists active sessions. Works even without Playwright installed.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  annotations: { title: 'Browser Status', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

export const browserUseToolDefinitions: ToolDefinition[] = [
  browserLaunch,
  browserScreenshot,
  browserClick,
  browserType,
  browserScroll,
  browserDrag,
  browserKey,
  browserNavigate,
  browserClose,
  browserStatus,
];

export { BROWSER_TOOLS };
