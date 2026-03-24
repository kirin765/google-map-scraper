import type { PageLike, PlaceRecord, ReviewPhotoRecord, ReviewRecord } from '../types/shared.js';
import { createIsoTimestamp, safeTrim, toInteger, uniqueStrings } from '../types/shared.js';
import { createReviewPhotoRecord } from '../models/review-photo.js';
import { stableId } from '../utils/ids.js';
import { extractAnchors, extractElementsByAttribute, extractImageTags } from '../utils/html.js';
import { isSameGoogleMapsPlaceUrl } from '../utils/maps-url.js';
import { scrollUntilStable, waitForPageReady } from '../browser/waits.js';
import { DEFAULT_SCROLL_ATTEMPTS, DEFAULT_SCROLL_SETTLE_MS } from '../config/defaults.js';

export interface ReviewPhotoScrapeOptions {
  settleMs?: number;
  scrollAttempts?: number;
}

export function extractReviewPhotosFromHtml(html: string, place: PlaceRecord, reviews: ReviewRecord[] = []): ReviewPhotoRecord[] {
  const reviewMap = new Map(reviews.map((review) => [review.id, review]));
  const records: ReviewPhotoRecord[] = [];
  const scrapedAt = createIsoTimestamp();
  const blocks = extractElementsByAttribute(html, 'data-review-id');
  const reviewPhotoUrls = new Set<string>();

  for (const block of blocks) {
    const reviewId = safeTrim(block.attributes['data-review-id']);
    const review = reviewId ? reviewMap.get(reviewId) ?? null : null;
    const photoEntries = extractReviewPhotoEntries(block.innerHtml, {
      authorName: review?.authorName ?? null,
      reviewId,
    });

    for (const entry of photoEntries) {
      reviewPhotoUrls.add(entry.imageUrl);
      records.push(
        createReviewPhotoRecord({
          placeId: place.id,
          placeUrl: place.sourceUrl,
          photoKind: 'review',
          reviewId,
          reviewUrl: review?.sourceUrl ?? null,
          imageUrl: entry.imageUrl,
          sourceUrl: review?.sourceUrl ?? place.sourceUrl,
          thumbnailUrl: entry.thumbnailUrl,
          altText: entry.altText,
          width: entry.width,
          height: entry.height,
          scrapedAt,
          id: stableId([place.id, reviewId ?? '', entry.imageUrl]),
        })
      );
    }
  }

  const nonReviewHtml = removeReviewBlocks(html);
  const placeEntries = extractPlacePhotoEntries(nonReviewHtml, {
    excludeUrls: reviewPhotoUrls,
  });

  const placeRecords = placeEntries.map((entry) =>
    createReviewPhotoRecord({
      placeId: place.id,
      placeUrl: place.sourceUrl,
      photoKind: 'place',
      reviewId: null,
      reviewUrl: null,
      imageUrl: entry.imageUrl,
      sourceUrl: place.sourceUrl,
      thumbnailUrl: entry.thumbnailUrl,
      altText: entry.altText,
      width: entry.width,
      height: entry.height,
      scrapedAt,
      id: stableId([place.id, entry.imageUrl]),
    })
  );

  return [...records, ...placeRecords];
}

export async function scrapeReviewPhotos(
  page: PageLike,
  place: PlaceRecord,
  reviews: ReviewRecord[] = [],
  options: ReviewPhotoScrapeOptions = {}
): Promise<ReviewPhotoRecord[]> {
  if (!isSameGoogleMapsPlaceUrl(page.url(), place.sourceUrl)) {
    await page.goto(place.sourceUrl, { waitUntil: 'domcontentloaded' });
  }

  await waitForPageReady(page, {
    loadState: 'domcontentloaded',
    settleMs: options.settleMs ?? DEFAULT_SCROLL_SETTLE_MS,
  });
  await scrollUntilStable(page, {
    maxAttempts: options.scrollAttempts ?? DEFAULT_SCROLL_ATTEMPTS,
    settleMs: options.settleMs ?? DEFAULT_SCROLL_SETTLE_MS,
  });

  const html = await page.content();
  return extractReviewPhotosFromHtml(html, place, reviews);
}

export interface PhotoEntry {
  imageUrl: string;
  thumbnailUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export function extractReviewPhotoEntries(
  html: string,
  options: {
    authorName?: string | null;
    reviewId?: string | null;
  } = {}
): PhotoEntry[] {
  return extractPhotoEntries(html, {
    kind: 'review',
    authorName: options.authorName ?? null,
  });
}

export function extractPlacePhotoEntries(
  html: string,
  options: {
    excludeUrls?: Iterable<string>;
  } = {}
): PhotoEntry[] {
  const excluded = new Set(options.excludeUrls ?? []);
  return extractPhotoEntries(html, {
    kind: 'place',
  }).filter((entry) => !excluded.has(entry.imageUrl));
}

function extractPhotoEntries(
  html: string,
  options: {
    kind: 'review' | 'place';
    authorName?: string | null;
  }
): PhotoEntry[] {
  const entries: PhotoEntry[] = [];
  const images = extractImageTags(html);

  for (const image of images) {
    const imageUrl = safeTrim(image.attributes['data-photo-url']) ?? safeTrim(image.attributes.src);
    if (!imageUrl) {
      continue;
    }

     if (!shouldIncludePhotoCandidate(
      {
        imageUrl,
        thumbnailUrl: safeTrim(image.attributes.src) ?? null,
        altText: safeTrim(image.attributes.alt) ?? null,
        titleText: safeTrim(image.attributes.title) ?? null,
        width: toInteger(image.attributes.width),
        height: toInteger(image.attributes.height),
        raw: image.raw,
      },
      options
    )) {
      continue;
    }

    entries.push({
      imageUrl,
      thumbnailUrl: safeTrim(image.attributes.src) ?? null,
      altText: safeTrim(image.attributes.alt) ?? null,
      width: toInteger(image.attributes.width),
      height: toInteger(image.attributes.height),
    });
  }

  for (const anchor of extractAnchors(html)) {
    const href = safeTrim(anchor.attributes.href);
    if (!href || !/googleusercontent\.com|lh3\.googleusercontent\.com/i.test(href)) {
      continue;
    }

    if (
      !shouldIncludePhotoCandidate(
        {
          imageUrl: href,
          thumbnailUrl: safeTrim(anchor.attributes['data-thumbnail-url']) ?? null,
          altText: safeTrim(anchor.attributes.title) ?? safeTrim(anchor.attributes['aria-label']) ?? null,
          titleText: safeTrim(anchor.attributes.title) ?? null,
          width: toInteger(anchor.attributes.width),
          height: toInteger(anchor.attributes.height),
          raw: anchor.raw,
        },
        options
      )
    ) {
      continue;
    }

    entries.push({
      imageUrl: href,
      thumbnailUrl: safeTrim(anchor.attributes['data-thumbnail-url']) ?? null,
      altText: safeTrim(anchor.attributes.title) ?? null,
      width: toInteger(anchor.attributes.width),
      height: toInteger(anchor.attributes.height),
    });
  }

  const deduped = new Map<string, PhotoEntry>();
  for (const entry of entries) {
    deduped.set(entry.imageUrl, entry);
  }

  return [...deduped.values()];
}

interface PhotoCandidate {
  imageUrl: string;
  thumbnailUrl: string | null;
  altText: string | null;
  titleText: string | null;
  width: number | null;
  height: number | null;
  raw: string;
}

function shouldIncludePhotoCandidate(
  candidate: PhotoCandidate,
  options: {
    kind: 'review' | 'place';
    authorName?: string | null;
  }
): boolean {
  const lowerContext = [candidate.altText, candidate.titleText, candidate.raw, candidate.imageUrl, candidate.thumbnailUrl]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();

  const hasExplicitPhotoData = /data-photo-url|data-thumbnail-url|data-photo-index|data-photo-id/i.test(candidate.raw);
  const mentionsProfile = /\b(profile|avatar|reviewer|author|user icon|user photo)\b/i.test(lowerContext);
  const mentionsReviewPhoto = /\b(photo|image|gallery|food|drink|dish|meal|interior|menu|place)\b/i.test(lowerContext);
  const authorName = safeTrim(options.authorName)?.toLowerCase() ?? null;
  const mentionsAuthorName = authorName ? lowerContext.includes(authorName) : false;
  const smallSquareAvatar =
    candidate.width !== null &&
    candidate.height !== null &&
    candidate.width <= 128 &&
    candidate.height <= 128 &&
    Math.abs(candidate.width - candidate.height) <= 24;
  const likelyProfileUrl = /avatar|profile|userphoto|reviewer/i.test(candidate.imageUrl);

  if (hasExplicitPhotoData) {
    return true;
  }

  if (mentionsProfile || likelyProfileUrl || (mentionsAuthorName && smallSquareAvatar)) {
    return false;
  }

  if (smallSquareAvatar && !mentionsReviewPhoto) {
    return false;
  }

  if (!/googleusercontent\.com|lh3\.googleusercontent\.com/i.test(candidate.imageUrl)) {
    return false;
  }

  if (options.kind === 'place') {
    return !smallSquareAvatar;
  }

  return mentionsReviewPhoto || candidate.width === null || candidate.height === null || candidate.width >= 160 || candidate.height >= 160;
}

function removeReviewBlocks(html: string): string {
  return html.replace(/<article\b[^>]*data-review-id=["'][^"']+["'][\s\S]*?<\/article>/gi, ' ');
}
