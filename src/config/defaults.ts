import type { BrowserName, BrowserViewport, OutputFormat } from '../types/shared.js';

export const DEFAULT_BROWSER_NAME: BrowserName = 'chromium';
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'ndjson';
export const DEFAULT_OUTPUT_DIR = 'output';
export const DEFAULT_MAX_PLACES_PER_KEYWORD = 25;
export const DEFAULT_MAX_REVIEWS_PER_PLACE = 20;
export const DEFAULT_HEADLESS = true;
export const DEFAULT_LOCALE = 'ko-KR';
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_RETRY_DELAY_MS = 750;
export const DEFAULT_SCROLL_ATTEMPTS = 8;
export const DEFAULT_SCROLL_SETTLE_MS = 500;
export const DEFAULT_KEYWORD_BATCH_SIZE = 1;
export const DEFAULT_CHECKPOINT_FILENAME = 'google-map-scraper.checkpoint.json';
export const DEFAULT_VIEWPORT: BrowserViewport = {
  width: 1440,
  height: 1080,
};

export const DEFAULT_BROWSER_ARGS = ['--disable-dev-shm-usage', '--disable-gpu'];
