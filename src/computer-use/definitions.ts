import { type ToolDefinition } from '../types.js';
import { CU_TOOLS } from './types.js';

export const computerUseToolDefinitions: ToolDefinition[] = [
  {
    name: CU_TOOLS.LIST_APPS,
    description:
      'List running and recently used macOS apps. Call this first to discover available apps.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'List Apps',
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: CU_TOOLS.GET_APP_STATE,
    description:
      'Get screenshot and accessibility tree for an app. Must be called once per turn before interacting with the app.',
    inputSchema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'App name or bundle identifier (e.g., "Safari", "com.apple.Safari")',
        },
      },
      required: ['app'],
    },
    annotations: {
      title: 'Get App State',
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: CU_TOOLS.CLICK,
    description:
      'Click an element by index or pixel coordinates. Prefer element_index when available from accessibility tree.',
    inputSchema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'App name or bundle identifier',
        },
        element_index: {
          type: 'string',
          description: 'Element index from accessibility tree',
        },
        x: {
          type: 'number',
          description: 'X coordinate in screenshot pixel coordinates',
        },
        y: {
          type: 'number',
          description: 'Y coordinate in screenshot pixel coordinates',
        },
        mouse_button: {
          type: 'string',
          enum: ['left', 'right', 'middle'],
          description: 'Mouse button to click (default: left)',
        },
        click_count: {
          type: 'integer',
          description: 'Number of clicks (default: 1)',
        },
      },
      required: ['app'],
    },
    annotations: {
      title: 'Click',
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: CU_TOOLS.PERFORM_SECONDARY_ACTION,
    description:
      'Invoke a secondary accessibility action exposed by an element (e.g., toggle, expand, pick)',
    inputSchema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'App name or bundle identifier',
        },
        element_index: {
          type: 'string',
          description: 'Element identifier',
        },
        action: {
          type: 'string',
          description: 'Secondary accessibility action name',
        },
      },
      required: ['app', 'element_index', 'action'],
    },
    annotations: {
      title: 'Secondary Action',
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: CU_TOOLS.SET_VALUE,
    description:
      'Set the value of a settable accessibility element (e.g., slider, text field)',
    inputSchema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'App name or bundle identifier',
        },
        element_index: {
          type: 'string',
          description: 'Element identifier',
        },
        value: {
          type: 'string',
          description: 'Value to assign',
        },
      },
      required: ['app', 'element_index', 'value'],
    },
    annotations: {
      title: 'Set Value',
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: CU_TOOLS.SCROLL,
    description:
      'Scroll an element in a direction by a number of pages',
    inputSchema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'App name or bundle identifier',
        },
        element_index: {
          type: 'string',
          description: 'Element identifier',
        },
        direction: {
          type: 'string',
          description: 'Scroll direction: up, down, left, or right',
        },
        pages: {
          type: 'integer',
          description: 'Number of page scroll actions (default: 1)',
        },
      },
      required: ['app', 'element_index', 'direction'],
    },
    annotations: {
      title: 'Scroll',
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: CU_TOOLS.DRAG,
    description:
      'Drag from one point to another using pixel coordinates',
    inputSchema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'App name or bundle identifier',
        },
        from_x: {
          type: 'number',
          description: 'Start X coordinate',
        },
        from_y: {
          type: 'number',
          description: 'Start Y coordinate',
        },
        to_x: {
          type: 'number',
          description: 'End X coordinate',
        },
        to_y: {
          type: 'number',
          description: 'End Y coordinate',
        },
      },
      required: ['app', 'from_x', 'from_y', 'to_x', 'to_y'],
    },
    annotations: {
      title: 'Drag',
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: CU_TOOLS.PRESS_KEY,
    description:
      'Press a key or key-combination. Supports xdotool key syntax: "a", "Return", "Tab", "super+c", "Up"',
    inputSchema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'App name or bundle identifier',
        },
        key: {
          type: 'string',
          description: 'Key or key combination to press',
        },
      },
      required: ['app', 'key'],
    },
    annotations: {
      title: 'Press Key',
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: CU_TOOLS.TYPE_TEXT,
    description:
      'Type literal text using keyboard input',
    inputSchema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'App name or bundle identifier',
        },
        text: {
          type: 'string',
          description: 'Literal text to type',
        },
      },
      required: ['app', 'text'],
    },
    annotations: {
      title: 'Type Text',
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: CU_TOOLS.STATUS,
    description:
      'Check Computer Use service status, binary path, and connection health',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'Computer Use Status',
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
];
