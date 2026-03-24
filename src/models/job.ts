import {
  DEFAULT_BROWSER_NAME,
  DEFAULT_CHECKPOINT_FILENAME,
  DEFAULT_HEADLESS,
  DEFAULT_KEYWORD_BATCH_SIZE,
  DEFAULT_LOCALE,
  DEFAULT_MAX_PLACES_PER_KEYWORD,
  DEFAULT_MAX_REVIEWS_PER_PLACE,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  DEFAULT_VIEWPORT,
} from '../config/defaults.js';
import type { BrowserName, BrowserViewport, OutputFormat, ScrapeJobInput, ScrapeJobOverrides } from '../types/shared.js';
import { createIsoTimestamp, safeTrim, uniqueStrings } from '../types/shared.js';
import { sanitizeFilename, slugify } from '../utils/ids.js';

export interface ScrapeJobCreationInput extends ScrapeJobOverrides {
  keywords: string[];
  region: string;
}

export function normalizeKeywords(keywords: string[]): string[] {
  return uniqueStrings(keywords);
}

export function normalizeRegion(region: string): string {
  const normalized = safeTrim(region);
  if (!normalized) {
    throw new Error('A region is required to build a scrape job.');
  }

  return normalized;
}

export function createScrapeJob(input: ScrapeJobCreationInput): ScrapeJobInput {
  const keywords = normalizeKeywords(input.keywords);
  if (keywords.length === 0) {
    throw new Error('At least one keyword is required to build a scrape job.');
  }

  const region = normalizeRegion(input.region);
  const viewport = normalizeViewport(input.viewport);

  return {
    keywords,
    region,
    outputDir: safeTrim(input.outputDir) ?? DEFAULT_OUTPUT_DIR,
    outputFormat: normalizeOutputFormat(input.outputFormat),
    maxPlacesPerKeyword: normalizePositiveInteger(input.maxPlacesPerKeyword, DEFAULT_MAX_PLACES_PER_KEYWORD),
    maxReviewsPerPlace: normalizePositiveInteger(input.maxReviewsPerPlace, DEFAULT_MAX_REVIEWS_PER_PLACE),
    headless: input.headless ?? DEFAULT_HEADLESS,
    browserName: normalizeBrowserName(input.browserName),
    browserExecutablePath: safeTrim(input.browserExecutablePath) ?? undefined,
    locale: safeTrim(input.locale) ?? DEFAULT_LOCALE,
    userAgent: safeTrim(input.userAgent) ?? DEFAULT_USER_AGENT,
    proxy: safeTrim(input.proxy) ?? undefined,
    timeoutMs: normalizePositiveInteger(input.timeoutMs, DEFAULT_TIMEOUT_MS),
    retryAttempts: normalizePositiveInteger(input.retryAttempts, DEFAULT_RETRY_ATTEMPTS),
    retryDelayMs: normalizePositiveInteger(input.retryDelayMs, DEFAULT_RETRY_DELAY_MS),
    checkpointPath: safeTrim(input.checkpointPath) ?? undefined,
    resume: input.resume ?? false,
    debug: input.debug ?? false,
    dryRun: input.dryRun ?? false,
    keywordBatchSize: normalizePositiveInteger(input.keywordBatchSize, DEFAULT_KEYWORD_BATCH_SIZE),
    viewport,
  };
}

export function createDefaultCheckpointPath(job: Pick<ScrapeJobInput, 'keywords' | 'region' | 'outputDir' | 'outputFormat'>): string {
  return `${job.outputDir}/${createCheckpointFileName(job)}`;
}

export function createRunLabel(job: Pick<ScrapeJobInput, 'keywords' | 'region'>): string {
  return `${job.region} :: ${job.keywords.join(', ')}`;
}

export function createOutputBaseName(job: Pick<ScrapeJobInput, 'keywords' | 'region'>): string {
  return sanitizeFilename(`${job.region}-${job.keywords.join('-')}`);
}

export function createOutputFileName(job: Pick<ScrapeJobInput, 'keywords' | 'region'>, format: OutputFormat): string {
  return `${createOutputBaseName(job)}.${format}`;
}

export function createCheckpointFileName(job: Pick<ScrapeJobInput, 'keywords' | 'region'>): string {
  return `${createOutputBaseName(job)}.checkpoint.json`;
}

export function createJobSummary(job: ScrapeJobInput): Record<string, unknown> {
  return {
    label: createRunLabel(job),
    output: createOutputFileName(job, job.outputFormat),
    headless: job.headless,
    browserName: job.browserName,
    viewport: job.viewport,
    updatedAt: createIsoTimestamp(),
  };
}

function normalizeBrowserName(browserName: BrowserName | undefined): BrowserName {
  return browserName ?? DEFAULT_BROWSER_NAME;
}

function normalizeOutputFormat(outputFormat: OutputFormat | undefined): OutputFormat {
  return outputFormat ?? DEFAULT_OUTPUT_FORMAT;
}

function normalizePositiveInteger(value: number | string | undefined, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(parsed));
}

function normalizeViewport(viewport: BrowserViewport | undefined): BrowserViewport {
  return viewport ?? DEFAULT_VIEWPORT;
}
