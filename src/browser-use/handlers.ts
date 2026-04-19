import { TOOLS, type ToolResult, type ToolHandlerContext } from '../types.js';
import { ToolExecutionError, ValidationError } from '../errors.js';
import { ZodError } from 'zod';
import { bridge } from './bridge.js';
import { BROWSER_SCHEMAS, normalizeKey } from './types.js';

const noopContext: ToolHandlerContext = { sendProgress: async () => {} };

export class BrowserUseToolHandler {
  async execute(
    toolName: string,
    args: unknown,
    _context: ToolHandlerContext = noopContext
  ): Promise<ToolResult> {
    try {
      const schema = BROWSER_SCHEMAS[toolName];
      if (!schema) {
        throw new ValidationError(toolName, `Unknown browser tool: ${toolName}`);
      }
      const p = schema.parse(args) as Record<string, unknown>;

      switch (toolName) {
        case TOOLS.BROWSER_STATUS: {
          await bridge.checkAvailability();
          const status = bridge.getStatus();
          return {
            content: [
              { type: 'text', text: JSON.stringify(status, null, 2) },
            ],
          };
        }
        case TOOLS.BROWSER_LAUNCH: {
          const session = await bridge.launch(
            p.sessionId as string,
            {
              url: p.url as string | undefined,
              headless: p.headless as boolean | undefined,
              viewportWidth: p.viewportWidth as number | undefined,
              viewportHeight: p.viewportHeight as number | undefined,
            }
          );
          return {
            content: [
              {
                type: 'text',
                text: `Browser session "${session.sessionId}" launched successfully at ${session.createdAt.toISOString()}`,
              },
            ],
          };
        }
        case TOOLS.BROWSER_SCREENSHOT: {
          const { image, url, title } = await bridge.screenshot(p.sessionId as string);
          return {
            content: [
              { type: 'image', text: '', data: image.toString('base64'), mimeType: 'image/png' },
              { type: 'text', text: `URL: ${url}\nTitle: ${title}` },
            ],
          };
        }
        case TOOLS.BROWSER_CLICK: {
          const x = p.x as number;
          const y = p.y as number;
          await bridge.click(p.sessionId as string, x, y, {
            button: p.button as string | undefined,
            clickCount: p.clickCount as number | undefined,
          });
          return {
            content: [{ type: 'text', text: `Clicked at (${x}, ${y}) with ${p.button ?? 'left'} button` }],
          };
        }
        case TOOLS.BROWSER_TYPE: {
          const text = p.text as string;
          await bridge.type(p.sessionId as string, text);
          return {
            content: [{ type: 'text', text: `Typed "${text}"` }],
          };
        }
        case TOOLS.BROWSER_SCROLL: {
          const direction = p.direction as string;
          const amount = p.amount as number;
          await bridge.scroll(p.sessionId as string, direction, amount);
          return {
            content: [{ type: 'text', text: `Scrolled ${direction} by ${amount}px` }],
          };
        }
        case TOOLS.BROWSER_DRAG: {
          const fromX = p.fromX as number;
          const fromY = p.fromY as number;
          const toX = p.toX as number;
          const toY = p.toY as number;
          await bridge.drag(p.sessionId as string, fromX, fromY, toX, toY);
          return {
            content: [{ type: 'text', text: `Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})` }],
          };
        }
        case TOOLS.BROWSER_KEY: {
          const key = p.key as string;
          const normalizedKey = normalizeKey(key);
          await bridge.key(p.sessionId as string, normalizedKey);
          return {
            content: [{ type: 'text', text: `Pressed key: ${key}` }],
          };
        }
        case TOOLS.BROWSER_NAVIGATE: {
          const url = p.url as string;
          await bridge.navigate(p.sessionId as string, url);
          return {
            content: [{ type: 'text', text: `Navigated to ${url}` }],
          };
        }
        case TOOLS.BROWSER_CLOSE: {
          const sessionId = p.sessionId as string;
          await bridge.close(sessionId);
          return {
            content: [{ type: 'text', text: `Session "${sessionId}" closed` }],
          };
        }
        default:
          throw new ValidationError(toolName, `Unknown browser tool: ${toolName}`);
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof ZodError) {
        throw new ValidationError(toolName, error.message);
      }
      throw new ToolExecutionError(toolName, 'Browser operation failed', error);
    }
  }
}

export const browserUseHandler = new BrowserUseToolHandler();
