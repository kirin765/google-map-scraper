import {
  DEFAULT_BROWSER_ARGS,
  DEFAULT_BROWSER_NAME,
  DEFAULT_HEADLESS,
  DEFAULT_TIMEOUT_MS,
} from '../config/defaults.js';
import type { BrowserLike, BrowserLaunchOptions, BrowserLauncher, ScrapeJobInput } from '../types/shared.js';
import { safeTrim } from '../types/shared.js';

export interface BrowserLaunchRequest {
  browserName?: BrowserLaunchOptions['browserName'];
  headless?: boolean;
  browserExecutablePath?: string;
  proxy?: string;
  timeoutMs?: number;
  args?: string[];
}

export function buildBrowserLaunchOptions(request: BrowserLaunchRequest = {}): BrowserLaunchOptions {
  return {
    browserName: request.browserName ?? DEFAULT_BROWSER_NAME,
    headless: request.headless ?? DEFAULT_HEADLESS,
    executablePath: safeTrim(request.browserExecutablePath) ?? undefined,
    args: request.args ?? [...DEFAULT_BROWSER_ARGS],
    proxy: safeTrim(request.proxy) ?? undefined,
    timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

export function buildBrowserLaunchOptionsFromJob(job: Pick<ScrapeJobInput, 'browserName' | 'headless' | 'browserExecutablePath' | 'proxy' | 'timeoutMs'>): BrowserLaunchOptions {
  return buildBrowserLaunchOptions({
    browserName: job.browserName,
    headless: job.headless,
    browserExecutablePath: job.browserExecutablePath,
    proxy: job.proxy,
    timeoutMs: job.timeoutMs,
  });
}

export function createBrowserLauncher(launchFn: (options: BrowserLaunchOptions) => Promise<unknown>): BrowserLauncher {
  return async (options: BrowserLaunchOptions): Promise<BrowserLike> => launchFn(options) as Promise<BrowserLike>;
}

export async function createPlaywrightBrowserLauncher(): Promise<BrowserLauncher> {
  let playwright: typeof import('playwright');

  try {
    playwright = await import('playwright');
  } catch (error) {
    throw new Error('Playwright is not installed. Install the `playwright` package or provide a custom browser launcher.', {
      cause: error,
    });
  }

  return async (options: BrowserLaunchOptions): Promise<BrowserLike> => {
    const browserType =
      options.browserName === 'firefox'
        ? playwright.firefox
        : options.browserName === 'webkit'
          ? playwright.webkit
          : playwright.chromium;

    const browser = await browserType.launch({
      headless: options.headless,
      executablePath: options.executablePath,
      args: options.args,
      proxy: options.proxy ? { server: options.proxy } : undefined,
      timeout: options.timeoutMs,
    });

    return browser as BrowserLike;
  };
}
