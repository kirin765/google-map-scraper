import { loadScraperEnvironment, mergeEnvironmentOverrides } from '../config/env.js';
import type { BrowserName, OutputFormat, ScrapeJobInput, ScrapeJobOverrides } from '../types/shared.js';
import { parseDelimitedList, safeTrim, toFiniteNumber, toInteger, uniqueStrings } from '../types/shared.js';
import { createScrapeJob, type ScrapeJobCreationInput } from '../models/job.js';

export interface ParsedCliArgs {
  keywords: string[];
  region?: string;
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
  resume?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  help?: boolean;
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const parsed: ParsedCliArgs = {
    keywords: [],
  };
  const valueFlags = new Set([
    '--keyword',
    '--keywords',
    '-k',
    '--region',
    '-r',
    '--output',
    '-o',
    '--format',
    '--output-format',
    '--max-places',
    '--max-reviews',
    '--browser',
    '--browser-name',
    '--browser-executable-path',
    '--locale',
    '--user-agent',
    '--proxy',
    '--timeout-ms',
    '--retry-attempts',
    '--retry-delay-ms',
    '--checkpoint',
    '--checkpoint-path',
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    const { flag, inlineValue } = splitFlag(token);
    const needsValue = valueFlags.has(flag);
    const nextToken = argv[index + 1];
    const value = needsValue
      ? inlineValue ?? (nextToken !== undefined && !nextToken.startsWith('-') ? nextToken : null)
      : inlineValue;

    if (needsValue && inlineValue === null && value !== null) {
      index += 1;
    }

    switch (flag) {
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      case '--keyword':
      case '--keywords':
      case '-k':
        parsed.keywords.push(...parseDelimitedList(requireValue(flag, value)));
        break;
      case '--region':
      case '-r':
        parsed.region = normalizeStringFlag(requireValue(flag, value));
        break;
      case '--output':
      case '-o':
        parsed.outputDir = normalizeStringFlag(requireValue(flag, value));
        break;
      case '--format':
      case '--output-format':
        parsed.outputFormat = parseOutputFormat(requireValue(flag, value));
        break;
      case '--max-places':
        parsed.maxPlacesPerKeyword = parsePositiveInteger(requireValue(flag, value));
        break;
      case '--max-reviews':
        parsed.maxReviewsPerPlace = parsePositiveInteger(requireValue(flag, value));
        break;
      case '--browser':
      case '--browser-name':
        parsed.browserName = parseBrowserName(requireValue(flag, value));
        break;
      case '--browser-executable-path':
        parsed.browserExecutablePath = normalizeStringFlag(requireValue(flag, value));
        break;
      case '--locale':
        parsed.locale = normalizeStringFlag(requireValue(flag, value));
        break;
      case '--user-agent':
        parsed.userAgent = normalizeStringFlag(requireValue(flag, value));
        break;
      case '--proxy':
        parsed.proxy = normalizeStringFlag(requireValue(flag, value));
        break;
      case '--timeout-ms':
        parsed.timeoutMs = parsePositiveInteger(requireValue(flag, value));
        break;
      case '--retry-attempts':
        parsed.retryAttempts = parsePositiveInteger(requireValue(flag, value));
        break;
      case '--retry-delay-ms':
        parsed.retryDelayMs = parsePositiveInteger(requireValue(flag, value));
        break;
      case '--checkpoint':
      case '--checkpoint-path':
        parsed.checkpointPath = normalizeStringFlag(requireValue(flag, value));
        break;
      case '--headless':
        parsed.headless = parseBooleanFlag(value, true);
        break;
      case '--headed':
        parsed.headless = !parseBooleanFlag(value, false);
        break;
      case '--resume':
        parsed.resume = true;
        break;
      case '--debug':
        parsed.debug = true;
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      default:
        throw new Error(`Unknown CLI argument: ${token}`);
    }
  }

  parsed.keywords = uniqueStrings(parsed.keywords);
  return parsed;
}

export function buildScrapeJobFromCliArgs(argv: string[]): ScrapeJobInput {
  return buildScrapeJobFromParsedArgs(parseCliArgs(argv));
}

export function buildScrapeJobFromParsedArgs(cliArgs: ParsedCliArgs): ScrapeJobInput {
  const env = loadScraperEnvironment();
  const overrides: ScrapeJobOverrides = mergeEnvironmentOverrides(cliArgs, env);
  const keywords = cliArgs.keywords.length > 0 ? cliArgs.keywords : env.keywords ?? [];

  return createScrapeJob({
    ...overrides,
    keywords,
    region: cliArgs.region ?? env.region ?? '',
  });
}

export function printCliUsage(): string {
  return [
    'Usage:',
    '  google-map-scraper --keywords cafe,restaurant --region "Seoul, South Korea"',
    '',
    'Common flags:',
    '  --keywords, --keyword, -k   Comma-separated keywords (repeatable)',
    '  --region, -r                Target region',
    '  --output, -o                Output directory',
    '  --format                    json | ndjson',
    '  --max-places                Max places per keyword',
    '  --max-reviews               Max reviews per place',
    '  --headless / --headed       Browser mode',
    '  --resume                    Resume from checkpoint',
    '  --dry-run                   Skip browser execution',
  ].join('\n');
}

function splitFlag(token: string): { flag: string; inlineValue: string | null } {
  const equalsIndex = token.indexOf('=');
  if (equalsIndex >= 0) {
    return {
      flag: token.slice(0, equalsIndex),
      inlineValue: token.slice(equalsIndex + 1),
    };
  }

  return {
    flag: token,
    inlineValue: null,
  };
}

function requireValue(flag: string, value: string | null): string {
  const resolved = safeTrim(value);
  if (resolved) {
    return resolved;
  }

  throw new Error(`Missing value for ${flag}`);
}

function parseBooleanFlag(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }

  const normalized = safeTrim(value)?.toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean value: ${value}`);
}

function normalizeStringFlag(value: string): string {
  const normalized = safeTrim(value);
  if (!normalized) {
    throw new Error('CLI flag value must not be empty.');
  }

  return normalized;
}

function parsePositiveInteger(value: string): number {
  const parsed = toInteger(value);
  if (parsed === null || parsed < 1) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return parsed;
}

function parseOutputFormat(value: string): OutputFormat {
  const normalized = normalizeStringFlag(value).toLowerCase();
  if (normalized === 'json' || normalized === 'ndjson') {
    return normalized;
  }

  throw new Error(`Unsupported output format: ${value}`);
}

function parseBrowserName(value: string): BrowserName {
  const normalized = normalizeStringFlag(value).toLowerCase();
  if (normalized === 'chromium' || normalized === 'firefox' || normalized === 'webkit') {
    return normalized;
  }

  throw new Error(`Unsupported browser name: ${value}`);
}
