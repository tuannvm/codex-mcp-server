import type { Browser, BrowserContext, Page } from 'playwright';
import type { BrowserSession } from './types.js';
import { ToolExecutionError } from '../errors.js';

let playwrightPromise: Promise<typeof import('playwright')> | null = null;

function getPlaywright(): Promise<typeof import('playwright')> {
  if (!playwrightPromise) {
    playwrightPromise = import('playwright').catch((err) => {
      playwrightPromise = null;
      throw new ToolExecutionError(
        'Playwright is not installed. Install it with: npm install playwright && npx playwright install chromium',
        err
      );
    });
  }
  return playwrightPromise;
}

export async function createBrowserSession(
  sessionId: string,
  opts: {
    url?: string;
    headless?: boolean;
    viewportWidth?: number;
    viewportHeight?: number;
  } = {}
): Promise<BrowserSession> {
  if (opts.url) {
    const parsed = new URL(opts.url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ToolExecutionError(
        'browser',
        `Unsupported URL protocol "${parsed.protocol}". Only http(s) is allowed.`
      );
    }
  }

  const pw = await getPlaywright();
  const browser = await pw.chromium.launch({
    headless: opts.headless ?? true,
  });

  try {
    const context = await (
      browser as unknown as {
        newContext(opts?: Record<string, unknown>): Promise<BrowserContext>;
      }
    ).newContext({
      viewport: {
        width: opts.viewportWidth ?? 1440,
        height: opts.viewportHeight ?? 900,
      },
    });

    const page = await context.newPage();

    if (opts.url) {
      await page.goto(opts.url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    return { sessionId, browser, page, createdAt: new Date() };
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

export async function takeScreenshot(
  session: BrowserSession
): Promise<{ image: Buffer; url: string; title: string }> {
  const page = session.page as Page;
  const [image, title] = await Promise.all([
    page.screenshot({ type: 'png', fullPage: false }),
    page.title(),
  ]);
  return { image, url: page.url(), title };
}

export async function clickAt(
  session: BrowserSession,
  x: number,
  y: number,
  opts?: { button?: string; clickCount?: number }
): Promise<void> {
  const page = session.page as Page;
  await page.mouse.click(x, y, {
    button: opts?.button ?? 'left',
    clickCount: opts?.clickCount ?? 1,
  });
}

export async function typeText(
  session: BrowserSession,
  text: string
): Promise<void> {
  const page = session.page as Page;
  await page.keyboard.type(text, { delay: 20 });
}

export async function pressKey(
  session: BrowserSession,
  key: string
): Promise<void> {
  const page = session.page as Page;
  await page.keyboard.press(key);
}

export async function scrollPage(
  session: BrowserSession,
  direction: string,
  amount: number
): Promise<void> {
  const page = session.page as Page;
  const delta = direction === 'up' || direction === 'left' ? -amount : amount;
  const x = direction === 'left' || direction === 'right' ? delta : 0;
  const y = direction === 'up' || direction === 'down' ? delta : 0;
  await page.mouse.wheel(x, y);
}

export async function dragFromTo(
  session: BrowserSession,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): Promise<void> {
  const page = session.page as Page;
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 10 });
  await page.mouse.up();
}

export async function navigateTo(
  session: BrowserSession,
  url: string
): Promise<void> {
  const page = session.page as Page;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
}

export async function closeSession(session: BrowserSession): Promise<void> {
  const browser = session.browser as Browser;
  try {
    await browser.close();
  } catch (err) {
    // Browser may already be closed; log unexpected failures
    if (
      err instanceof Error &&
      !err.message.includes('Target closed') &&
      !err.message.includes('Connection closed')
    ) {
      console.debug(`closeSession error:`, err);
    }
  }
}
