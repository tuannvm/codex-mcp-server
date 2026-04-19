import type { BrowserSession, BrowserStatus } from './types.js';
import {
  createBrowserSession,
  takeScreenshot,
  clickAt,
  typeText,
  pressKey,
  scrollPage,
  dragFromTo,
  navigateTo,
  closeSession,
} from './client.js';

class BrowserUseBridge {
  private sessions: Map<string, BrowserSession> = new Map();
  private available: boolean | null = null;
  private checkError: string | null = null;

  async checkAvailability(): Promise<boolean> {
    if (this.available !== null) return this.available;
    try {
      await import('playwright');
      this.available = true;
      this.checkError = null;
    } catch {
      this.available = false;
      this.checkError = 'Playwright is not installed. Install with: npm install playwright && npx playwright install chromium';
    }
    return this.available;
  }

  async launch(sessionId: string, opts?: { url?: string; headless?: boolean; viewportWidth?: number; viewportHeight?: number }): Promise<BrowserSession> {
    const canUse = await this.checkAvailability();
    if (!canUse) {
      throw new Error(this.checkError ?? 'Playwright is not installed');
    }
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session "${sessionId}" already exists. Close it first or use a different session ID.`);
    }
    const session = await createBrowserSession(sessionId, opts);
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): BrowserSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No active browser session with ID "${sessionId}". Use browser with action "open" to create one.`);
    }
    return session;
  }

  async screenshot(sessionId: string): Promise<{ image: Buffer; url: string; title: string }> {
    return takeScreenshot(this.getSession(sessionId));
  }

  async click(sessionId: string, x: number, y: number, opts?: { button?: string; clickCount?: number }): Promise<void> {
    return clickAt(this.getSession(sessionId), x, y, opts);
  }

  async type(sessionId: string, text: string): Promise<void> {
    return typeText(this.getSession(sessionId), text);
  }

  async key(sessionId: string, key: string): Promise<void> {
    return pressKey(this.getSession(sessionId), key);
  }

  async scroll(sessionId: string, direction: string, amount: number): Promise<void> {
    return scrollPage(this.getSession(sessionId), direction, amount);
  }

  async drag(sessionId: string, fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    return dragFromTo(this.getSession(sessionId), fromX, fromY, toX, toY);
  }

  async navigate(sessionId: string, url: string): Promise<void> {
    return navigateTo(this.getSession(sessionId), url);
  }

  async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await closeSession(session);
      this.sessions.delete(sessionId);
    }
  }

  async shutdown(): Promise<void> {
    const closings = Array.from(this.sessions.values()).map((s) => closeSession(s).catch(() => {}));
    await Promise.all(closings);
    this.sessions.clear();
  }

  getStatus(): BrowserStatus {
    return {
      available: this.available ?? false,
      error: this.checkError,
      activeSessions: this.sessions.size,
      sessionIds: Array.from(this.sessions.keys()),
    };
  }
}

// Singleton
export const bridge = new BrowserUseBridge();
