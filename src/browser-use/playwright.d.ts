declare module 'playwright' {
  export interface Browser {
    newContext(opts?: Record<string, unknown>): Promise<BrowserContext>;
    close(): Promise<void>;
  }

  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface Page {
    goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
    screenshot(opts?: Record<string, unknown>): Promise<Buffer>;
    mouse: {
      click(x: number, y: number, opts?: Record<string, unknown>): Promise<void>;
      move(x: number, y: number, opts?: Record<string, unknown>): Promise<void>;
      down(): Promise<void>;
      up(): Promise<void>;
      wheel(deltaX: number, deltaY: number): Promise<void>;
    };
    keyboard: {
      press(key: string): Promise<void>;
      type(text: string, opts?: Record<string, unknown>): Promise<void>;
    };
    title(): Promise<string>;
    url(): string;
    waitForLoadState(state?: string): Promise<void>;
  }

  export const chromium: {
    launch(opts?: Record<string, unknown>): Promise<Browser>;
  };
}
