export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type OutputFormat = 'json' | 'ndjson';
export type LoadState = 'domcontentloaded' | 'load' | 'networkidle';

export interface BrowserViewport {
  width: number;
  height: number;
}

export interface BrowserContextOptions {
  locale?: string;
  timezoneId?: string;
  userAgent?: string;
  viewport?: BrowserViewport;
  extraHTTPHeaders?: Record<string, string>;
  storageState?: string | Record<string, unknown>;
  ignoreHTTPSErrors?: boolean;
  bypassCSP?: boolean;
}

export interface BrowserLaunchOptions extends BrowserContextOptions {
  browserName: BrowserName;
  headless: boolean;
  executablePath?: string;
  args?: string[];
  proxy?: string;
  timeoutMs?: number;
}

export interface GotoOptions {
  waitUntil?: LoadState;
  timeoutMs?: number;
  referer?: string;
}

export interface PageLike {
  goto(url: string, options?: GotoOptions): Promise<void>;
  content(): Promise<string>;
  evaluate<T>(pageFunction: ((...args: any[]) => T) | string, ...args: unknown[]): Promise<T>;
  waitForLoadState?(state?: LoadState): Promise<void>;
  waitForTimeout?(timeoutMs: number): Promise<void>;
  url(): string;
  title?(): Promise<string>;
  close?(): Promise<void>;
}

export interface BrowserContextLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
  pages?(): Promise<PageLike[]>;
}

export interface BrowserLike {
  newContext(options?: BrowserContextOptions): Promise<BrowserContextLike>;
  close?(): Promise<void>;
}

export interface BrowserLauncher {
  (options: BrowserLaunchOptions): Promise<BrowserLike>;
}

export interface CdpSessionLike {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: (payload: unknown) => void): void;
  detach?(): Promise<void>;
}

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface SearchResultItem {
  id: string;
  keyword: string;
  region: string;
  title: string;
  placeUrl: string;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  snippet: string | null;
  rank: number;
  rawLabel: string | null;
  scrapedAt: string;
}

export interface PlaceRecord {
  id: string;
  searchResultId: string;
  searchKeyword: string;
  region: string;
  name: string;
  category: string | null;
  address: string | null;
  coordinates: GeoCoordinates | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  sourceUrl: string;
  searchUrl: string;
  rawTitle: string | null;
  rawLabel: string | null;
  keywords: string[];
  scrapedAt: string;
  rawHtml?: string;
}

export interface ReviewRecord {
  id: string;
  placeId: string;
  placeUrl: string;
  authorName: string | null;
  authorProfileUrl: string | null;
  rating: number | null;
  publishedAt: string | null;
  text: string | null;
  translatedText: string | null;
  likes: number | null;
  sourceUrl: string;
  photoIds: string[];
  scrapedAt: string;
  rawLabel: string | null;
}

export interface ReviewPhotoRecord {
  id: string;
  placeId: string;
  placeUrl: string;
  reviewId: string | null;
  reviewUrl: string | null;
  photoKind: 'review' | 'place';
  imageUrl: string;
  thumbnailUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  sourceUrl: string | null;
  scrapedAt: string;
}

export interface ExportRecordPlace {
  type: 'place';
  data: PlaceRecord;
}

export interface ExportRecordReview {
  type: 'review';
  data: ReviewRecord;
}

export interface ExportRecordReviewPhoto {
  type: 'review-photo';
  data: ReviewPhotoRecord;
}

export interface ExportRecordRun {
  type: 'run';
  data: {
    job: ScrapeJobInput;
    checkpoint: CheckpointState;
    searchResultCount: number;
    placeCount: number;
    reviewCount: number;
    photoCount: number;
  };
}

export type ExportRecord = ExportRecordPlace | ExportRecordReview | ExportRecordReviewPhoto | ExportRecordRun;

export interface CheckpointState {
  version: 1;
  region: string;
  keywords: string[];
  nextKeywordIndex: number;
  nextPlaceIndexByKeyword: Record<string, number>;
  completedPlaceIds: string[];
  updatedAt: string;
}

export interface ScrapeJobInput {
  keywords: string[];
  region: string;
  outputDir: string;
  outputFormat: OutputFormat;
  maxPlacesPerKeyword: number;
  maxReviewsPerPlace: number;
  headless: boolean;
  browserName: BrowserName;
  browserExecutablePath?: string;
  locale: string;
  userAgent: string;
  proxy?: string;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  checkpointPath?: string;
  resume: boolean;
  debug: boolean;
  dryRun: boolean;
  keywordBatchSize: number;
  viewport: BrowserViewport;
}

export interface ScrapeRunResult {
  job: ScrapeJobInput;
  searchResults: SearchResultItem[];
  places: PlaceRecord[];
  reviews: ReviewRecord[];
  photos: ReviewPhotoRecord[];
  checkpoint: CheckpointState;
}

export interface ScrapeJobOverrides {
  keywords?: string[];
  region?: string;
  outputDir?: string;
  outputFormat?: OutputFormat;
  maxPlacesPerKeyword?: number;
  maxReviewsPerPlace?: number;
  headless?: boolean;
  browserName?: BrowserName;
  browserExecutablePath?: string;
  locale?: string;
  userAgent?: string;
  proxy?: string;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  checkpointPath?: string;
  resume?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  keywordBatchSize?: number;
  viewport?: BrowserViewport;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(scope: string, context?: Record<string, unknown>): Logger;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function safeTrim(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

export function isNonEmptyString(value: unknown): value is string {
  return safeTrim(value) !== null;
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeWhitespace(value).replace(/,/g, '');
  if (!normalized.length) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toInteger(value: unknown): number | null {
  const number = toFiniteNumber(value);
  return number === null ? null : Math.trunc(number);
}

export function uniqueStrings(values: Iterable<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = safeTrim(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function compactObject<T extends Record<string, unknown>>(value: T): T {
  const compacted: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      compacted[key] = entry;
    }
  }

  return compacted as T;
}

export function parseDelimitedList(value: string, separators: RegExp = /[,;\n]+/): string[] {
  return uniqueStrings(value.split(separators));
}

export function createIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function firstNonNullish<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}
