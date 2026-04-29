import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { buildBrowserContextOptions, openBrowserPage } from '../browser/context.js';
import { buildBrowserLaunchOptionsFromJob, createPlaywrightBrowserLauncher } from '../browser/launch.js';
import type { BrowserLauncher, CheckpointState, Logger, PlaceRecord, ReviewPhotoRecord, ReviewRecord, ScrapeJobInput, ScrapeRunResult, SearchResultItem } from '../types/shared.js';
import { advanceKeywordCheckpoint, createCheckpointState, loadCheckpoint, markPlaceCheckpoint, normalizeCheckpointState, saveCheckpoint } from '../utils/checkpoint.js';
import { createLogger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';

async function retryWithLogging<T>(
  op: () => Promise<T>,
  label: string,
  logger: Logger,
  job: Pick<ScrapeJobInput, 'retryAttempts' | 'retryDelayMs'>
): Promise<T> {
  return retry(op, {
    attempts: job.retryAttempts,
    delayMs: job.retryDelayMs,
    onRetry(error, attempt, delayMs) {
      logger.warn(`${label} retry scheduled`, { attempt, delayMs, error: error instanceof Error ? error.message : String(error) });
    },
  });
}

function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}
import { scrapeSearchResults } from '../scrapers/search-results.js';
import { scrapePlaceDetails } from '../scrapers/place-details.js';
import { scrapeReviews } from '../scrapers/reviews.js';
import { scrapeReviewPhotos } from '../scrapers/review-photos.js';
import { writeJsonExport } from '../exporters/json.js';
import { writeNdjsonExport } from '../exporters/ndjson.js';
import { createCheckpointFileName, createOutputFileName } from '../models/job.js';

export interface ScrapePipelineDependencies {
  browserLauncher?: BrowserLauncher;
  logger?: Logger;
}

export interface ScrapePipelineResult extends ScrapeRunResult {
  outputPath: string;
  checkpointPath: string;
}

export interface ResolvedCheckpointState {
  checkpoint: CheckpointState;
  completedKeywords: string[];
  activeKeyword: string | null;
}

export async function scrapeRegionKeywords(job: ScrapeJobInput, dependencies: ScrapePipelineDependencies = {}): Promise<ScrapePipelineResult> {
  const logger = dependencies.logger ?? createLogger({ scope: 'pipeline' });
  const checkpointPath = resolveCheckpointPath(job);
  const resolvedCheckpoint = await resolveCheckpoint(job, checkpointPath);
  const checkpoint = resolvedCheckpoint.checkpoint;
  const outputPath = join(job.outputDir, createOutputFileName(job, job.outputFormat));

  await mkdir(job.outputDir, { recursive: true });

  if (job.dryRun) {
    const emptyResult: ScrapeRunResult = {
      job,
      searchResults: [],
      places: [],
      reviews: [],
      photos: [],
      checkpoint,
    };

    await persistExport(outputPath, emptyResult, job.outputFormat);
    await saveCheckpoint(checkpointPath, checkpoint);

    return {
      ...emptyResult,
      outputPath,
      checkpointPath,
    };
  }

  const browserLauncher = dependencies.browserLauncher ?? (await createPlaywrightBrowserLauncher());
  const browser = await browserLauncher(buildBrowserLaunchOptionsFromJob(job));
  const session = await openBrowserPage(browser, buildBrowserContextOptions(job));

  const searchResults: SearchResultItem[] = [];
  const places: PlaceRecord[] = [];
  const reviews: ReviewRecord[] = [];
  const photos: ReviewPhotoRecord[] = [];
  const seenPlaceIds = new Set<string>(checkpoint.completedPlaceIds);
  const completedKeywordsFromResume = new Set<string>(resolvedCheckpoint.completedKeywords);

  let currentCheckpoint = checkpoint;

  try {
    for (let keywordIndex = currentCheckpoint.nextKeywordIndex; keywordIndex < job.keywords.length; keywordIndex += 1) {
      const keyword = job.keywords[keywordIndex];
      if (!keyword) {
        continue;
      }

      if (completedKeywordsFromResume.has(keyword)) {
        logger.info('skipping keyword already completed in checkpoint', {
          keyword,
          region: job.region,
        });
        currentCheckpoint = advanceKeywordCheckpoint(currentCheckpoint, keywordIndex + 1);
        await saveCheckpoint(checkpointPath, currentCheckpoint);
        continue;
      }

      const keywordLogger = logger.child('keyword', createSearchResultsLoggerContext(keyword, job.region, keywordIndex));
      const startPlaceIndex = currentCheckpoint.nextPlaceIndexByKeyword[keyword] ?? 0;

      keywordLogger.info('starting keyword search', {
        keyword,
        region: job.region,
        startPlaceIndex,
      });

      const keywordResults = await retryWithLogging(
        () =>
          scrapeSearchResults(session.page, {
            keyword,
            region: job.region,
            limit: job.maxPlacesPerKeyword,
          }),
        'search',
        keywordLogger,
        job
      );

      searchResults.push(...keywordResults);

      for (let placeIndex = startPlaceIndex; placeIndex < keywordResults.length; placeIndex += 1) {
        const searchResult = keywordResults[placeIndex];
        if (!searchResult) {
          break;
        }
        const placeLogger = keywordLogger.child('place', {
          placeIndex,
          placeUrl: searchResult.placeUrl,
          title: searchResult.title,
        });

        const place = await retryWithLogging(
          () => scrapePlaceDetails(session.page, searchResult),
          'place detail',
          placeLogger,
          job
        );

        if (seenPlaceIds.has(place.id)) {
          currentCheckpoint = markPlaceCheckpoint(currentCheckpoint, keyword, placeIndex + 1);
          await saveCheckpoint(checkpointPath, currentCheckpoint);
          continue;
        }

        seenPlaceIds.add(place.id);
        places.push(place);

        const placeReviews = await retryWithLogging(
          () => scrapeReviews(session.page, place, { limit: job.maxReviewsPerPlace }),
          'review',
          placeLogger,
          job
        );

        reviews.push(...placeReviews);

        const placePhotos = await retryWithLogging(
          () => scrapeReviewPhotos(session.page, place, placeReviews),
          'review-photo',
          placeLogger,
          job
        );

        photos.push(...placePhotos);

        currentCheckpoint = markPlaceCheckpoint(currentCheckpoint, keyword, placeIndex + 1, place.id);
        await saveCheckpoint(checkpointPath, currentCheckpoint);
      }

      currentCheckpoint = advanceKeywordCheckpoint(currentCheckpoint, keywordIndex + 1);
      await saveCheckpoint(checkpointPath, currentCheckpoint);
    }

    const result: ScrapeRunResult = {
      job,
      searchResults,
      places,
      reviews,
      photos,
      checkpoint: currentCheckpoint,
    };

    await persistExport(outputPath, result, job.outputFormat);

    return {
      ...result,
      outputPath,
      checkpointPath,
    };
  } finally {
    await session.close();
  }
}

export async function resolveCheckpoint(job: ScrapeJobInput, checkpointPath: string): Promise<ResolvedCheckpointState> {
  if (!job.resume) {
    return {
      checkpoint: createCheckpointState(job),
      completedKeywords: [],
      activeKeyword: null,
    };
  }

  const existing = await loadCheckpoint(checkpointPath);
  if (!existing) {
    return {
      checkpoint: createCheckpointState(job),
      completedKeywords: [],
      activeKeyword: null,
    };
  }

  if (existing.region !== job.region || !hasSameKeywordSet(existing.keywords, job.keywords)) {
    throw new Error('Checkpoint does not match the current scrape job.');
  }

  return reconcileCheckpoint(job, existing);
}

async function persistExport(outputPath: string, result: ScrapeRunResult, outputFormat: ScrapeJobInput['outputFormat']): Promise<void> {
  if (outputFormat === 'json') {
    await writeJsonExport(outputPath, result);
    return;
  }

  if (outputFormat === 'ndjson') {
    await writeNdjsonExport(outputPath, result);
    return;
  }

  assertNever(outputFormat);
}

function resolveCheckpointPath(job: ScrapeJobInput): string {
  return job.checkpointPath ?? join(job.outputDir, createCheckpointFileName(job));
}

export function createPipelineSummary(result: ScrapePipelineResult): Record<string, unknown> {
  return {
    outputPath: result.outputPath,
    checkpointPath: result.checkpointPath,
    placeCount: result.places.length,
    reviewCount: result.reviews.length,
    photoCount: result.photos.length,
    searchResultCount: result.searchResults.length,
  };
}

export function createSearchResultsLoggerContext(keyword: string, region: string, keywordIndex: number): Record<string, unknown> {
  return {
    keyword,
    region,
    keywordIndex,
  };
}

export function hasSameKeywordSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size !== rightSet.size) {
    return false;
  }

  for (const keyword of rightSet) {
    if (!leftSet.has(keyword)) {
      return false;
    }
  }

  return true;
}

export function reconcileCheckpoint(job: Pick<ScrapeJobInput, 'keywords' | 'region'>, existing: CheckpointState): ResolvedCheckpointState {
  const completedKeywords = existing.keywords.slice(0, existing.nextKeywordIndex).filter((keyword) => keyword.length > 0);
  const completedKeywordSet = new Set(completedKeywords);
  const activeKeyword = existing.nextKeywordIndex < existing.keywords.length ? (existing.keywords[existing.nextKeywordIndex] ?? null) : null;

  const nextKeywordIndex = resolveNextKeywordIndex(job.keywords, completedKeywordSet);

  return {
    checkpoint: normalizeCheckpointState({
      ...existing,
      region: job.region,
      keywords: [...job.keywords],
      nextKeywordIndex,
    }),
    completedKeywords,
    activeKeyword,
  };
}

function resolveNextKeywordIndex(jobKeywords: string[], completedKeywordSet: Set<string>): number {
  for (let index = 0; index < jobKeywords.length; index += 1) {
    const keyword = jobKeywords[index];
    if (keyword && !completedKeywordSet.has(keyword)) {
      return index;
    }
  }

  return jobKeywords.length;
}
