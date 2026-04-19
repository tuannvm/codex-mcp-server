import { type ToolResult, type ToolHandlerContext } from '../types.js';
import { ToolExecutionError, ValidationError } from '../errors.js';
import { ZodError } from 'zod';
import {
  CU_TOOLS,
  CU_TO_BINARY,
  CU_SCHEMAS,
} from './types.js';
import { ComputerUseBridge } from './bridge.js';

// Default no-op context for handlers that don't need progress.
const defaultContext: ToolHandlerContext = {
  sendProgress: async () => {},
};

export class ComputerUseToolHandler {
  async execute(
    toolName: string,
    args: unknown,
    context: ToolHandlerContext = defaultContext
  ): Promise<ToolResult> {
    // Status tool works on any platform (reports binary not found).
    if (toolName === CU_TOOLS.STATUS) {
      return this.handleStatus();
    }

    // Guard: computer-use tools require macOS.
    if (process.platform !== 'darwin') {
      throw new ToolExecutionError(
        toolName,
        'Computer Use tools are only available on macOS'
      );
    }

    // Validate tool name.
    const binaryToolName = CU_TO_BINARY[toolName];
    if (!binaryToolName) {
      throw new Error(`Unknown computer-use tool: ${toolName}`);
    }

    try {
      // Validate input with Zod.
      const schema = CU_SCHEMAS[toolName];
      if (!schema) {
        throw new Error(`No schema for tool: ${toolName}`);
      }
      const parsed = schema.parse(args);

      // Ensure bridge is initialized (lazy).
      const bridge = ComputerUseBridge.getInstance();
      if (!bridge.isReady()) {
        await context.sendProgress('Connecting to Computer Use binary...', 0);
        await bridge.initialize();
      }

      const client = bridge.getClient();
      const result = await client.callTool(binaryToolName, parsed as Record<string, unknown>);
      return result;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof ZodError) {
        throw new ValidationError(toolName, error.message);
      }
      throw new ToolExecutionError(toolName, 'Computer Use tool failed', error);
    }
  }

  private handleStatus(): ToolResult {
    const bridge = ComputerUseBridge.getInstance();
    const binaryInfo = bridge.getBinaryInfo();
    const error = bridge.getError();

    const status = {
      connected: bridge.isReady(),
      binary: binaryInfo
        ? {
            path: binaryInfo.path,
            type: binaryInfo.type,
          }
        : null,
      error: error?.message || null,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }
}
