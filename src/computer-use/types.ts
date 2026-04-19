import { z } from 'zod';

// Tool names exposed by the Codex computer-use binary.
// Mapped to our prefixed names to avoid collision with Claude Code's
// native computer-use module.
export const CU_TOOLS = {
  LIST_APPS: 'cu_list_apps',
  GET_APP_STATE: 'cu_get_app_state',
  CLICK: 'cu_click',
  PERFORM_SECONDARY_ACTION: 'cu_perform_secondary_action',
  SET_VALUE: 'cu_set_value',
  SCROLL: 'cu_scroll',
  DRAG: 'cu_drag',
  PRESS_KEY: 'cu_press_key',
  TYPE_TEXT: 'cu_type_text',
  STATUS: 'cu_status',
} as const;

// Internal binary tool names (no prefix) for proxying to the subprocess.
export const BINARY_TOOLS = {
  LIST_APPS: 'list_apps',
  GET_APP_STATE: 'get_app_state',
  CLICK: 'click',
  PERFORM_SECONDARY_ACTION: 'perform_secondary_action',
  SET_VALUE: 'set_value',
  SCROLL: 'scroll',
  DRAG: 'drag',
  PRESS_KEY: 'press_key',
  TYPE_TEXT: 'type_text',
} as const;

// Map from our prefixed name → binary tool name.
export const CU_TO_BINARY: Record<string, string> = {
  [CU_TOOLS.LIST_APPS]: BINARY_TOOLS.LIST_APPS,
  [CU_TOOLS.GET_APP_STATE]: BINARY_TOOLS.GET_APP_STATE,
  [CU_TOOLS.CLICK]: BINARY_TOOLS.CLICK,
  [CU_TOOLS.PERFORM_SECONDARY_ACTION]: BINARY_TOOLS.PERFORM_SECONDARY_ACTION,
  [CU_TOOLS.SET_VALUE]: BINARY_TOOLS.SET_VALUE,
  [CU_TOOLS.SCROLL]: BINARY_TOOLS.SCROLL,
  [CU_TOOLS.DRAG]: BINARY_TOOLS.DRAG,
  [CU_TOOLS.PRESS_KEY]: BINARY_TOOLS.PRESS_KEY,
  [CU_TOOLS.TYPE_TEXT]: BINARY_TOOLS.TYPE_TEXT,
};

// Zod schemas matching the binary's exact input schemas (from tools/list).
export const ListAppsSchema = z.object({});

export const GetAppStateSchema = z.object({
  app: z.string().min(1, 'App name is required'),
});

export const ClickSchema = z.object({
  app: z.string().min(1, 'App name is required'),
  element_index: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  mouse_button: z.enum(['left', 'right', 'middle']).optional(),
  click_count: z.int().optional(),
});

export const PerformSecondaryActionSchema = z.object({
  app: z.string().min(1, 'App name is required'),
  element_index: z.string().min(1, 'Element index is required'),
  action: z.string().min(1, 'Action name is required'),
});

export const SetValueSchema = z.object({
  app: z.string().min(1, 'App name is required'),
  element_index: z.string().min(1, 'Element index is required'),
  value: z.string().min(1, 'Value is required'),
});

export const ScrollSchema = z.object({
  app: z.string().min(1, 'App name is required'),
  element_index: z.string().min(1, 'Element index is required'),
  direction: z.string().min(1, 'Scroll direction is required'),
  pages: z.int().optional(),
});

export const DragSchema = z.object({
  app: z.string().min(1, 'App name is required'),
  from_x: z.number(),
  from_y: z.number(),
  to_x: z.number(),
  to_y: z.number(),
});

export const PressKeySchema = z.object({
  app: z.string().min(1, 'App name is required'),
  key: z.string().min(1, 'Key is required'),
});

export const TypeTextSchema = z.object({
  app: z.string().min(1, 'App name is required'),
  text: z.string().min(1, 'Text is required'),
});

export const CuStatusSchema = z.object({});

// Map tool name → schema for runtime validation.
export const CU_SCHEMAS: Record<string, z.ZodType> = {
  [CU_TOOLS.LIST_APPS]: ListAppsSchema,
  [CU_TOOLS.GET_APP_STATE]: GetAppStateSchema,
  [CU_TOOLS.CLICK]: ClickSchema,
  [CU_TOOLS.PERFORM_SECONDARY_ACTION]: PerformSecondaryActionSchema,
  [CU_TOOLS.SET_VALUE]: SetValueSchema,
  [CU_TOOLS.SCROLL]: ScrollSchema,
  [CU_TOOLS.DRAG]: DragSchema,
  [CU_TOOLS.PRESS_KEY]: PressKeySchema,
  [CU_TOOLS.TYPE_TEXT]: TypeTextSchema,
  [CU_TOOLS.STATUS]: CuStatusSchema,
};

// Binary discovery info.
export interface BinaryInfo {
  path: string;
  type: 'npm-package' | 'codex-app' | 'custom';
  args: string[];
}

// JSON-RPC message types for direct stdio communication.
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}
