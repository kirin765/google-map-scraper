import {
  DEFAULT_BROWSER_NAME,
  DEFAULT_HEADLESS,
  DEFAULT_LOCALE,
  DEFAULT_MAX_PLACES_PER_KEYWORD,
  DEFAULT_MAX_REVIEWS_PER_PLACE,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from './defaults.js';
import type {
  BrowserName,
  BrowserViewport,
  OutputFormat,
  ScrapeJobOverrides,
} from '../types/shared.js';
import { parseDelimitedList, safeTrim, toFiniteNumber, toInteger, uniqueStrings } from '../types/shared.js';

export interface ScraperEnvironment {
  region?: string;
  keywords?: string[];
  outputDir?: string;
  outputFormat?: OutputFormat;
  maxPlacesPerKeyword?: number;
  maxReviewsPerPlace?: number;
  browserName?: BrowserName;
  browserExecutablePath?: string;
  headless?: boolean;
  locale?: string;
  userAgent?: string;
  proxy?: string;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  checkpointPath?: string;
  debug?: boolean;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = safeTrim(value);
  if (!normalized) {
    return fallback;
  }

  const lowered = normalized.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(lowered)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(lowered)) {
    return false;
  }

  throw new Error(`Invalid boolean environment value: ${value}`);
}

function parseBrowserName(value: string | undefined): BrowserName | undefined {
  const normalized = safeTrim(value);
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'chromium' || normalized === 'firefox' || normalized === 'webkit') {
    return normalized;
  }

  throw new Error(`Invalid browser name: ${value}`);
}

function parseOutputFormat(value: string | undefined): OutputFormat | undefined {
  const normalized = safeTrim(value);
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'json' || normalized === 'ndjson') {
    return normalized;
  }

  throw new Error(`Invalid output format: ${value}`);
}

function parseViewport(value: string | undefined): BrowserViewport | undefined {
  const normalized = safeTrim(value);
  if (!normalized) {
    return undefined;
  }

  const [widthText, heightText] = normalized.split(/[x,]/).map((part) => safeTrim(part)).filter(Boolean) as string[];
  const width = toInteger(widthText);
  const height = toInteger(heightText);

  if (width === null || height === null) {
    throw new Error(`Invalid viewport value: ${value}`);
  }

  return { width, height };
}

function parseKeywords(value: string | undefined): string[] | undefined {
  const normalized = safeTrim(value);
  if (!normalized) {
    return undefined;
  }

  return uniqueStrings(parseDelimitedList(normalized));
}

function readNumber(value: string | undefined): number | undefined {
  const parsed = toFiniteNumber(value);
  return parsed === null ? undefined : parsed;
}

export function loadScraperEnvironment(env: NodeJS.ProcessEnv = process.env): ScraperEnvironment {
  return {
    region: safeTrim(env.GOOGLE_MAP_SCRAPER_REGION) ?? undefined,
    keywords: parseKeywords(env.GOOGLE_MAP_SCRAPER_KEYWORDS),
    outputDir: safeTrim(env.GOOGLE_MAP_SCRAPER_OUTPUT_DIR) ?? DEFAULT_OUTPUT_DIR,
    outputFormat: parseOutputFormat(env.GOOGLE_MAP_SCRAPER_OUTPUT_FORMAT) ?? DEFAULT_OUTPUT_FORMAT,
    maxPlacesPerKeyword: readNumber(env.GOOGLE_MAP_SCRAPER_MAX_PLACES_PER_KEYWORD) ?? DEFAULT_MAX_PLACES_PER_KEYWORD,
    maxReviewsPerPlace: readNumber(env.GOOGLE_MAP_SCRAPER_MAX_REVIEWS_PER_PLACE) ?? DEFAULT_MAX_REVIEWS_PER_PLACE,
    browserName: parseBrowserName(env.GOOGLE_MAP_SCRAPER_BROWSER_NAME) ?? DEFAULT_BROWSER_NAME,
    browserExecutablePath: safeTrim(env.GOOGLE_MAP_SCRAPER_BROWSER_EXECUTABLE_PATH) ?? undefined,
    headless: parseBoolean(env.GOOGLE_MAP_SCRAPER_HEADLESS, DEFAULT_HEADLESS),
    locale: safeTrim(env.GOOGLE_MAP_SCRAPER_LOCALE) ?? DEFAULT_LOCALE,
    userAgent: safeTrim(env.GOOGLE_MAP_SCRAPER_USER_AGENT) ?? DEFAULT_USER_AGENT,
    proxy: safeTrim(env.GOOGLE_MAP_SCRAPER_PROXY) ?? undefined,
    timeoutMs: readNumber(env.GOOGLE_MAP_SCRAPER_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS,
    retryAttempts: readNumber(env.GOOGLE_MAP_SCRAPER_RETRY_ATTEMPTS) ?? DEFAULT_RETRY_ATTEMPTS,
    retryDelayMs: readNumber(env.GOOGLE_MAP_SCRAPER_RETRY_DELAY_MS) ?? DEFAULT_RETRY_DELAY_MS,
    checkpointPath: safeTrim(env.GOOGLE_MAP_SCRAPER_CHECKPOINT_PATH) ?? undefined,
    debug: parseBoolean(env.GOOGLE_MAP_SCRAPER_DEBUG, false),
  };
}

export function mergeEnvironmentOverrides(overrides: ScrapeJobOverrides, env: ScraperEnvironment): ScrapeJobOverrides {
  return {
    ...overrides,
    region: overrides.region ?? env.region,
    keywords: overrides.keywords ?? env.keywords,
    outputDir: overrides.outputDir ?? env.outputDir,
    outputFormat: overrides.outputFormat ?? env.outputFormat,
    maxPlacesPerKeyword: overrides.maxPlacesPerKeyword ?? env.maxPlacesPerKeyword,
    maxReviewsPerPlace: overrides.maxReviewsPerPlace ?? env.maxReviewsPerPlace,
    browserName: overrides.browserName ?? env.browserName,
    browserExecutablePath: overrides.browserExecutablePath ?? env.browserExecutablePath,
    headless: overrides.headless ?? env.headless,
    locale: overrides.locale ?? env.locale,
    userAgent: overrides.userAgent ?? env.userAgent,
    proxy: overrides.proxy ?? env.proxy,
    timeoutMs: overrides.timeoutMs ?? env.timeoutMs,
    retryAttempts: overrides.retryAttempts ?? env.retryAttempts,
    retryDelayMs: overrides.retryDelayMs ?? env.retryDelayMs,
    checkpointPath: overrides.checkpointPath ?? env.checkpointPath,
    debug: overrides.debug ?? env.debug,
    resume: overrides.resume,
    dryRun: overrides.dryRun,
  };
}
