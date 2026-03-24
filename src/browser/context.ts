import type { BrowserContextLike, BrowserContextOptions, BrowserLike, PageLike, ScrapeJobInput } from '../types/shared.js';
import { DEFAULT_VIEWPORT } from '../config/defaults.js';
import { safeTrim } from '../types/shared.js';

export interface BrowserSession {
  browser: BrowserLike;
  context: BrowserContextLike;
  page: PageLike;
  close(): Promise<void>;
}

export function buildBrowserContextOptions(job: Pick<ScrapeJobInput, 'locale' | 'userAgent' | 'viewport'>): BrowserContextOptions {
  return {
    locale: safeTrim(job.locale) ?? undefined,
    userAgent: safeTrim(job.userAgent) ?? undefined,
    viewport: job.viewport ?? DEFAULT_VIEWPORT,
  };
}

export async function openBrowserContext(browser: BrowserLike, options: BrowserContextOptions): Promise<BrowserContextLike> {
  return browser.newContext(options);
}

export async function openBrowserPage(browser: BrowserLike, options: BrowserContextOptions): Promise<BrowserSession> {
  const context = await openBrowserContext(browser, options);
  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    async close(): Promise<void> {
      await page.close?.();
      await context.close();
      await browser.close?.();
    },
  };
}

export async function withBrowserSession<T>(
  browser: BrowserLike,
  options: BrowserContextOptions,
  handler: (session: BrowserSession) => Promise<T>
): Promise<T> {
  const session = await openBrowserPage(browser, options);
  try {
    return await handler(session);
  } finally {
    await session.close();
  }
}
