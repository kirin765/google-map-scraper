import type { LoadState, PageLike } from '../types/shared.js';

export interface WaitForPageReadyOptions {
  loadState?: LoadState;
  settleMs?: number;
  timeoutMs?: number;
}

export interface ScrollOptions {
  stepPx?: number;
  maxAttempts?: number;
  settleMs?: number;
}

export async function waitForPageReady(page: PageLike, options: WaitForPageReadyOptions = {}): Promise<void> {
  const loadState = options.loadState ?? 'domcontentloaded';

  await page.waitForLoadState?.(loadState);
  if (options.timeoutMs && options.timeoutMs > 0) {
    await page.waitForTimeout?.(options.timeoutMs);
  }

  if (options.settleMs && options.settleMs > 0) {
    await page.waitForTimeout?.(options.settleMs);
  }
}

export async function waitForContentHeight(page: PageLike, attempts = 4, settleMs = 250): Promise<number> {
  let previousHeight = 0;
  let currentHeight = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (attempt > 0 && currentHeight === previousHeight) {
      break;
    }

    previousHeight = currentHeight;
    await page.waitForTimeout?.(settleMs);
  }

  return currentHeight;
}

export async function scrollPage(page: PageLike, options: ScrollOptions = {}): Promise<number> {
  const stepPx = options.stepPx ?? 1200;
  const settleMs = options.settleMs ?? 300;

  return page.evaluate(
    async (payload) => {
      const step = (payload as { stepPx: number }).stepPx;
      window.scrollBy(0, step);
      return document.body.scrollHeight;
    },
    { stepPx }
  ).finally(async () => {
    await page.waitForTimeout?.(settleMs);
  });
}

export async function scrollUntilStable(page: PageLike, options: ScrollOptions = {}): Promise<number> {
  const maxAttempts = options.maxAttempts ?? 8;
  const settleMs = options.settleMs ?? 350;
  let lastHeight = 0;
  let currentHeight = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (attempt > 0 && currentHeight === lastHeight) {
      break;
    }

    lastHeight = currentHeight;
    await page.evaluate((step) => {
      window.scrollBy(0, step);
    }, options.stepPx ?? 1200);
    await page.waitForTimeout?.(settleMs);
  }

  return currentHeight;
}

export async function waitForTextInPage(page: PageLike, text: string, settleMs = 250): Promise<boolean> {
  const normalizedText = text.trim().toLowerCase();
  const html = await page.content();
  const found = html.toLowerCase().includes(normalizedText);
  if (!found) {
    await page.waitForTimeout?.(settleMs);
  }

  return found;
}
