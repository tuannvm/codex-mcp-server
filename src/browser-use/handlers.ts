import { TOOLS, type ToolResult, type ToolHandlerContext } from '../types.js';
import { ToolExecutionError, ValidationError } from '../errors.js';
import { ZodError } from 'zod';
import { bridge } from './bridge.js';
import {
  parseBrowserAction,
  normalizeKey,
  type BrowserAction,
} from './types.js';

const noopContext: ToolHandlerContext = { sendProgress: async () => {} };

export class BrowserUseToolHandler {
  async execute(
    args: unknown,
    context: ToolHandlerContext = noopContext
  ): Promise<ToolResult> {
    try {
      const parsed = parseBrowserAction(args);
      return this.dispatch(parsed, context);
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof ZodError) {
        throw new ValidationError(TOOLS.BROWSER, error.message);
      }
      throw new ToolExecutionError(
        TOOLS.BROWSER,
        'Browser operation failed',
        error
      );
    }
  }

  private async dispatch(
    parsed: BrowserAction,
    ctx: ToolHandlerContext
  ): Promise<ToolResult> {
    switch (parsed.action) {
      case 'open':
        return this.handleOpen(parsed, ctx);
      case 'screenshot':
        return this.handleScreenshot(parsed, ctx);
      case 'navigate':
        return this.handleNavigate(parsed, ctx);
      case 'click':
        return this.handleClick(parsed);
      case 'type':
        return this.handleType(parsed);
      case 'key':
        return this.handleKey(parsed);
      case 'scroll':
        return this.handleScroll(parsed);
      case 'drag':
        return this.handleDrag(parsed);
      case 'close':
        return this.handleClose(parsed);
      case 'status':
        return this.handleStatus();
    }
  }

  private async handleOpen(
    args: {
      action: 'open';
      sessionId: string;
      url?: string;
      headless?: boolean;
      viewportWidth?: number;
      viewportHeight?: number;
    },
    context: ToolHandlerContext
  ): Promise<ToolResult> {
    await context.sendProgress('Launching browser...', 0);
    const session = await bridge.launch(args.sessionId, {
      url: args.url,
      headless: args.headless,
      viewportWidth: args.viewportWidth,
      viewportHeight: args.viewportHeight,
    });
    return {
      content: [
        {
          type: 'text',
          text: `Session "${session.sessionId}" opened at ${session.createdAt.toISOString()}`,
        },
      ],
    };
  }

  private async handleScreenshot(
    args: { action: 'screenshot'; sessionId: string },
    context: ToolHandlerContext
  ): Promise<ToolResult> {
    await context.sendProgress('Taking screenshot...', 0);
    const { image, url, title } = await bridge.screenshot(args.sessionId);
    return {
      content: [
        {
          type: 'image',
          text: '',
          data: image.toString('base64'),
          mimeType: 'image/png',
        },
        { type: 'text', text: `URL: ${url}\nTitle: ${title}` },
      ],
    };
  }

  private async handleNavigate(
    args: { action: 'navigate'; sessionId: string; url: string },
    context: ToolHandlerContext
  ): Promise<ToolResult> {
    await context.sendProgress(`Navigating to ${args.url}...`, 0);
    await bridge.navigate(args.sessionId, args.url);
    return { content: [{ type: 'text', text: `Navigated to ${args.url}` }] };
  }

  private async handleClick(args: {
    action: 'click';
    sessionId: string;
    x: number;
    y: number;
    button?: string;
    clickCount?: number;
  }): Promise<ToolResult> {
    await bridge.click(args.sessionId, args.x, args.y, {
      button: args.button,
      clickCount: args.clickCount,
    });
    return {
      content: [{ type: 'text', text: `Clicked at (${args.x}, ${args.y})` }],
    };
  }

  private async handleType(args: {
    action: 'type';
    sessionId: string;
    text: string;
  }): Promise<ToolResult> {
    await bridge.type(args.sessionId, args.text);
    return { content: [{ type: 'text', text: `Typed "${args.text}"` }] };
  }

  private async handleKey(args: {
    action: 'key';
    sessionId: string;
    key: string;
  }): Promise<ToolResult> {
    await bridge.key(args.sessionId, normalizeKey(args.key));
    return { content: [{ type: 'text', text: `Pressed key: ${args.key}` }] };
  }

  private async handleScroll(args: {
    action: 'scroll';
    sessionId: string;
    direction: string;
    amount: number;
  }): Promise<ToolResult> {
    await bridge.scroll(args.sessionId, args.direction, args.amount);
    return {
      content: [
        {
          type: 'text',
          text: `Scrolled ${args.direction} by ${args.amount}px`,
        },
      ],
    };
  }

  private async handleDrag(args: {
    action: 'drag';
    sessionId: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }): Promise<ToolResult> {
    await bridge.drag(
      args.sessionId,
      args.fromX,
      args.fromY,
      args.toX,
      args.toY
    );
    return {
      content: [
        {
          type: 'text',
          text: `Dragged from (${args.fromX}, ${args.fromY}) to (${args.toX}, ${args.toY})`,
        },
      ],
    };
  }

  private async handleClose(args: {
    action: 'close';
    sessionId: string;
  }): Promise<ToolResult> {
    await bridge.close(args.sessionId);
    return {
      content: [{ type: 'text', text: `Session "${args.sessionId}" closed` }],
    };
  }

  private async handleStatus(): Promise<ToolResult> {
    await bridge.checkAvailability();
    const status = bridge.getStatus();
    return {
      content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
    };
  }
}

export const browserUseHandler = new BrowserUseToolHandler();
