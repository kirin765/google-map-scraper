import { DEFAULT_SCROLL_ATTEMPTS, DEFAULT_SCROLL_SETTLE_MS } from '../config/defaults.js';
import { createIsoTimestamp, safeTrim, toFiniteNumber, toInteger } from '../types/shared.js';
import type { PageLike, PlaceRecord, ReviewRecord } from '../types/shared.js';
import { createReviewRecord } from '../models/review.js';
import { stableId } from '../utils/ids.js';
import {
  collapseWhitespace,
  extractAnchors,
  extractElementsByAttribute,
} from '../utils/html.js';
import { isSameGoogleMapsPlaceUrl } from '../utils/maps-url.js';
import { scrollUntilStable, waitForPageReady } from '../browser/waits.js';

export interface ReviewScrapeOptions {
  limit?: number;
  settleMs?: number;
  scrollAttempts?: number;
}

interface ParsedReviewBlock {
  reviewId: string | null;
  authorName: string | null;
  authorProfileUrl: string | null;
  rating: number | null;
  publishedAt: string | null;
  text: string | null;
  translatedText: string | null;
  likes: number | null;
  rawLabel: string | null;
  photoUrls: string[];
}

export function extractReviewsFromHtml(html: string, place: PlaceRecord, limit?: number): ReviewRecord[] {
  const blocks = extractElementsByAttribute(html, 'data-review-id');
  const reviews: ReviewRecord[] = [];
  const scrapedAt = createIsoTimestamp();

  for (const block of blocks) {
    const parsed = parseReviewBlock(block.innerHtml, block.attributes);
    const reviewId = parsed.reviewId ?? stableId([place.id, parsed.authorName, parsed.publishedAt, parsed.text, reviews.length]);

    reviews.push(
      createReviewRecord({
        placeId: place.id,
        placeUrl: place.sourceUrl,
        sourceUrl: place.sourceUrl,
        authorName: parsed.authorName,
        authorProfileUrl: parsed.authorProfileUrl,
        rating: parsed.rating,
        publishedAt: parsed.publishedAt,
        text: parsed.text,
        translatedText: parsed.translatedText,
        likes: parsed.likes,
        photoIds: parsed.photoUrls.map((photoUrl) => stableId([place.id, reviewId, photoUrl])),
        rawLabel: parsed.rawLabel,
        scrapedAt,
        id: reviewId,
      })
    );

    if (limit !== undefined && reviews.length >= Math.max(0, limit)) {
      break;
    }
  }

  return reviews;
}

export async function scrapeReviews(page: PageLike, place: PlaceRecord, options: ReviewScrapeOptions = {}): Promise<ReviewRecord[]> {
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
  return extractReviewsFromHtml(html, place, options.limit);
}

export function parseReviewBlock(fragment: string, attributes: Record<string, string>): ParsedReviewBlock {
  const reviewId = safeTrim(attributes['data-review-id']) ?? null;
  const rawLabel = safeTrim(attributes['aria-label']) ?? collapseWhitespace(fragment);
  const authorName = extractNestedText(fragment, ['data-author-name', 'data-author', 'data-review-author']) ?? parseAuthorFromLabel(rawLabel);
  const authorProfileUrl = extractNestedHref(fragment, ['data-author-url', 'data-profile-url', 'href']);
  const rating = extractRating(fragment, rawLabel);
  const publishedAt = extractPublishedAt(fragment, rawLabel);
  const text = extractReviewText(fragment);
  const translatedText = extractTranslatedText(fragment);
  const likes = extractLikes(fragment, rawLabel);
  return {
    reviewId,
    authorName,
    authorProfileUrl,
    rating,
    publishedAt,
    text,
    translatedText,
    likes,
    rawLabel,
    photoUrls: [],
  };
}

function extractNestedText(fragment: string, attributes: string[]): string | null {
  for (const attribute of attributes) {
    const blocks = extractElementsByAttribute(fragment, attribute, ['span', 'div', 'p', 'a', 'time']);
    for (const block of blocks) {
      const value = safeTrim(block.attributes[attribute]) ?? block.text;
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function extractNestedHref(fragment: string, attributes: string[]): string | null {
  const anchors = extractAnchors(fragment);
  for (const anchor of anchors) {
    for (const attribute of attributes) {
      const value = safeTrim(anchor.attributes[attribute]);
      if (value) {
        return value;
      }
    }

    const href = safeTrim(anchor.attributes.href);
    if (href) {
      return href;
    }
  }

  return null;
}

function parseAuthorFromLabel(label: string | null): string | null {
  if (!label) {
    return null;
  }

  const match = label.match(/^(?:reviewed by|by)\s+(.+?)(?:[·|]|$)/i);
  return match ? safeTrim(match[1]) : null;
}

function extractRating(fragment: string, label: string | null): number | null {
  const ratingCandidates = [label?.match(/([0-5](?:\.\d+)?)\s*(?:stars?|★)/i)?.[1], fragment.match(/data-rating=["']([^"']+)["']/i)?.[1]];

  for (const candidate of ratingCandidates) {
    const rating = toFiniteNumber(candidate);
    if (rating !== null) {
      return rating;
    }
  }

  return null;
}

function extractPublishedAt(fragment: string, label: string | null): string | null {
  const timeMatch = fragment.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i);
  if (timeMatch?.[1]) {
    return safeTrim(timeMatch[1]);
  }

  const labelMatch = label?.match(/(?:posted|reviewed)\s+on\s+(.+?)(?:[·|]|$)/i);
  return labelMatch ? safeTrim(labelMatch[1]) : null;
}

function extractReviewText(fragment: string): string | null {
  const explicitText = extractNestedText(fragment, ['data-review-text', 'data-text', 'data-content']);
  if (explicitText) {
    return collapseWhitespace(explicitText);
  }

  const stripped = collapseWhitespace(
    fragment
      .replace(/<time\b[\s\S]*?<\/time>/gi, ' ')
      .replace(/<img\b[\s\S]*?>/gi, ' ')
      .replace(/<button\b[\s\S]*?<\/button>/gi, ' ')
  );

  return stripped.length > 0 ? stripped : null;
}

function extractTranslatedText(fragment: string): string | null {
  const translated = extractNestedText(fragment, ['data-translated-text', 'data-google-translated-text']);
  return translated ? collapseWhitespace(translated) : null;
}

function extractLikes(fragment: string, label: string | null): number | null {
  const dataLikeCount = fragment.match(/data-like-count=["']([^"']+)["']/i)?.[1];
  const textLikeCount = label?.match(/([\d,]+)\s+likes?/i)?.[1];
  const likes = toInteger(dataLikeCount ?? textLikeCount);
  return likes;
}
