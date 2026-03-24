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

  for (const block of blocks) {
    const reviewId = safeTrim(block.attributes['data-review-id']);
    const review = reviewId ? reviewMap.get(reviewId) ?? null : null;
    const photoEntries = extractPhotoEntries(block.innerHtml);

    for (const entry of photoEntries) {
      records.push(
        createReviewPhotoRecord({
          placeId: place.id,
          placeUrl: place.sourceUrl,
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

  if (records.length > 0) {
    return records;
  }

  const fallbackEntries = extractPhotoEntries(html);
  return fallbackEntries.map((entry) =>
    createReviewPhotoRecord({
      placeId: place.id,
      placeUrl: place.sourceUrl,
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

interface PhotoEntry {
  imageUrl: string;
  thumbnailUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
}

function extractPhotoEntries(html: string): PhotoEntry[] {
  const entries: PhotoEntry[] = [];
  const images = extractImageTags(html);

  for (const image of images) {
    const imageUrl = safeTrim(image.attributes['data-photo-url']) ?? safeTrim(image.attributes.src);
    if (!imageUrl) {
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
