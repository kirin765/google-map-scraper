import { DEFAULT_SCROLL_ATTEMPTS, DEFAULT_SCROLL_SETTLE_MS } from '../config/defaults.js';
import type { PageLike, SearchResultItem } from '../types/shared.js';
import { createIsoTimestamp, normalizeWhitespace, safeTrim, toFiniteNumber, toInteger } from '../types/shared.js';
import { stableId } from '../utils/ids.js';
import { extractAnchors, collapseWhitespace } from '../utils/html.js';
import { isGoogleMapsPlaceUrl } from '../utils/selectors.js';
import { scrollUntilStable, waitForPageReady } from '../browser/waits.js';

export interface SearchResultsScrapeOptions {
  keyword: string;
  region: string;
  limit?: number;
  searchUrl?: string;
  scrollAttempts?: number;
  settleMs?: number;
}

export interface SearchResultLabelParts {
  title: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  snippet: string | null;
}

export function buildGoogleMapsSearchUrl(keyword: string, region: string): string {
  const query = normalizeWhitespace(`${keyword} ${region}`);
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

export function normalizeGoogleMapsUrl(url: string): string {
  try {
    return new URL(url, 'https://www.google.com').toString();
  } catch {
    return url;
  }
}

export function parseSearchResultLabel(label: string | null | undefined): SearchResultLabelParts {
  const normalized = safeTrim(label);
  if (!normalized) {
    return {
      title: null,
      category: null,
      rating: null,
      reviewCount: null,
      snippet: null,
    };
  }

  const segments = normalized
    .split(/[·•|]/)
    .map((segment) => safeTrim(segment))
    .filter((segment): segment is string => Boolean(segment));

  const ratingMatch = normalized.match(/([0-5](?:\.\d+)?)\s*(?:stars?|★)/i);
  const reviewCountMatch = normalized.match(/([\d,]+)\s*reviews?/i);

  let title = segments[0] ?? normalized;
  let category: string | null = null;
  const excludedSegments = new Set<string>();

  for (const segment of segments.slice(1)) {
    if (!category && !/^[\d.,]+\s*(?:stars?|reviews?|★)?$/i.test(segment)) {
      category = segment;
    }

    if (ratingMatch && ratingMatch[0] === segment) {
      excludedSegments.add(segment);
    }

    if (reviewCountMatch && reviewCountMatch[0] === segment) {
      excludedSegments.add(segment);
    }
  }

  const snippetSegments = segments.filter((segment) => !excludedSegments.has(segment) && segment !== title && segment !== category);

  return {
    title: title.length ? title : null,
    category,
    rating: ratingMatch ? toFiniteNumber(ratingMatch[1]) : null,
    reviewCount: reviewCountMatch ? toInteger(reviewCountMatch[1]) : null,
    snippet: snippetSegments.length ? snippetSegments.join(' · ') : null,
  };
}

export function extractSearchResultsFromHtml(html: string, options: SearchResultsScrapeOptions): SearchResultItem[] {
  const anchors = extractAnchors(html);
  const results: SearchResultItem[] = [];
  const seenUrls = new Set<string>();
  const scrapedAt = createIsoTimestamp();

  for (const anchor of anchors) {
    const href = safeTrim(anchor.attributes.href);
    if (!href || !isGoogleMapsPlaceUrl(href)) {
      continue;
    }

    const placeUrl = normalizeGoogleMapsUrl(href);
    if (seenUrls.has(placeUrl)) {
      continue;
    }

    const rawLabel = safeTrim(anchor.attributes['aria-label']) ?? safeTrim(anchor.attributes.title) ?? safeTrim(collapseWhitespace(anchor.innerHtml));
    const parsed = parseSearchResultLabel(rawLabel);
    const title = parsed.title ?? rawLabel ?? placeUrl;

    results.push({
      id: stableId([options.keyword, options.region, placeUrl, title, results.length]),
      keyword: options.keyword,
      region: options.region,
      title,
      placeUrl,
      category: parsed.category,
      rating: parsed.rating,
      reviewCount: parsed.reviewCount,
      snippet: parsed.snippet ?? null,
      rank: results.length + 1,
      rawLabel: rawLabel ?? null,
      scrapedAt,
    });

    seenUrls.add(placeUrl);

    if (options.limit !== undefined && results.length >= Math.max(0, options.limit)) {
      break;
    }
  }

  return results;
}

export async function scrapeSearchResults(page: PageLike, options: SearchResultsScrapeOptions): Promise<SearchResultItem[]> {
  const searchUrl = options.searchUrl ?? buildGoogleMapsSearchUrl(options.keyword, options.region);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await waitForPageReady(page, {
    loadState: 'domcontentloaded',
    settleMs: options.settleMs ?? DEFAULT_SCROLL_SETTLE_MS,
  });
  await scrollUntilStable(page, {
    maxAttempts: options.scrollAttempts ?? DEFAULT_SCROLL_ATTEMPTS,
    settleMs: options.settleMs ?? DEFAULT_SCROLL_SETTLE_MS,
  });

  const html = await page.content();
  return extractSearchResultsFromHtml(html, options);
}
