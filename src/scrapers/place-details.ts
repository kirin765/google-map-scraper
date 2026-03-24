import type { PageLike, PlaceRecord, SearchResultItem } from '../types/shared.js';
import { createIsoTimestamp, firstNonNullish, safeTrim, toFiniteNumber, toInteger } from '../types/shared.js';
import { createPlaceFromSearchResult, createPlaceRecord } from '../models/place.js';
import { stableId } from '../utils/ids.js';
import {
  collapseWhitespace,
  extractAnchors,
  extractAttributeValue,
  extractElementsByAttribute,
  extractJsonLdObjects,
  extractLinkHref,
  extractMetaContent,
  extractTextBetweenTags,
} from '../utils/html.js';
import { isSameGoogleMapsPlaceUrl } from '../utils/maps-url.js';
import { waitForPageReady } from '../browser/waits.js';

export interface PlaceDetailsScrapeOptions {
  settleMs?: number;
}

interface ParsedPlaceMetadata {
  name: string | null;
  category: string | null;
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  rawTitle: string | null;
  rawLabel: string | null;
  sourceUrl: string;
}

export function extractPlaceDetailsFromHtml(html: string, searchResult: SearchResultItem): PlaceRecord {
  const metadata = parsePlaceMetadata(html, searchResult);
  return createPlaceRecord({
    searchResultId: searchResult.id,
    searchKeyword: searchResult.keyword,
    region: searchResult.region,
    name: metadata.name ?? searchResult.title,
    sourceUrl: metadata.sourceUrl,
    searchUrl: searchResult.placeUrl,
    category: metadata.category ?? searchResult.category,
    address: metadata.address,
    coordinates: metadata.coordinates,
    rating: firstNonNullish(metadata.rating, searchResult.rating),
    reviewCount: firstNonNullish(metadata.reviewCount, searchResult.reviewCount),
    priceLevel: metadata.priceLevel,
    phone: metadata.phone,
    website: metadata.website,
    description: metadata.description,
    rawTitle: metadata.rawTitle,
    rawLabel: metadata.rawLabel ?? searchResult.rawLabel,
    keywords: [searchResult.keyword, searchResult.region, searchResult.title],
    scrapedAt: createIsoTimestamp(),
  });
}

export async function scrapePlaceDetails(
  page: PageLike,
  searchResult: SearchResultItem,
  options: PlaceDetailsScrapeOptions = {}
): Promise<PlaceRecord> {
  if (!isSameGoogleMapsPlaceUrl(page.url(), searchResult.placeUrl)) {
    await page.goto(searchResult.placeUrl, { waitUntil: 'domcontentloaded' });
  }

  await waitForPageReady(page, {
    loadState: 'domcontentloaded',
    settleMs: options.settleMs ?? 500,
  });

  const html = await page.content();
  return extractPlaceDetailsFromHtml(html, searchResult);
}

function parsePlaceMetadata(html: string, searchResult: SearchResultItem): ParsedPlaceMetadata {
  const jsonLdObjects = extractJsonLdObjects(html);
  const jsonLdPlace = findJsonLdPlace(jsonLdObjects);
  const title = firstNonNullish(
    extractMetaContent(html, [{ property: 'og:title' }, { name: 'twitter:title' }]),
    extractTextBetweenTags(html, 'title'),
    searchResult.title
  );
  const description = firstNonNullish(
    extractMetaContent(html, [{ name: 'description' }, { property: 'og:description' }]),
    jsonLdPlace ? stringifyDescription(jsonLdPlace) : null
  );
  const canonicalUrl = safeTrim(extractLinkHref(html, 'canonical')) ?? searchResult.placeUrl;
  const phone = extractTelephone(html);
  const website = extractExternalWebsite(html);
  const rawLabel = searchResult.rawLabel;

  return {
    name: firstNonNullish(extractPlaceName(jsonLdPlace), title, searchResult.title),
    category: firstNonNullish(extractPlaceCategory(jsonLdPlace), searchResult.category),
    address: extractPlaceAddress(jsonLdPlace),
    coordinates: extractCoordinates(jsonLdPlace),
    rating: firstNonNullish(extractPlaceRating(jsonLdPlace), searchResult.rating),
    reviewCount: firstNonNullish(extractPlaceReviewCount(jsonLdPlace), searchResult.reviewCount),
    priceLevel: extractPriceLevel(jsonLdPlace),
    phone,
    website,
    description,
    rawTitle: title,
    rawLabel,
    sourceUrl: canonicalUrl,
  };
}

function findJsonLdPlace(entries: unknown[]): Record<string, unknown> | null {
  for (const entry of entries) {
    if (entry && typeof entry === 'object') {
      const candidate = entry as Record<string, unknown>;
      const name = candidate.name;
      const address = candidate.address;
      const geo = candidate.geo;

      if (typeof name === 'string' || address !== undefined || geo !== undefined) {
        return candidate;
      }
    }
  }

  return null;
}

function extractPlaceName(jsonLdPlace: Record<string, unknown> | null): string | null {
  const name = jsonLdPlace?.name;
  return typeof name === 'string' ? safeTrim(name) : null;
}

function extractPlaceCategory(jsonLdPlace: Record<string, unknown> | null): string | null {
  const type = jsonLdPlace?.['@type'];
  return typeof type === 'string' ? safeTrim(type) : null;
}

function extractPlaceAddress(jsonLdPlace: Record<string, unknown> | null): string | null {
  if (!jsonLdPlace) {
    return null;
  }

  const address = jsonLdPlace.address;
  if (!address || typeof address !== 'object') {
    return null;
  }

  const addressRecord = address as Record<string, unknown>;
  const parts = [
    addressRecord.streetAddress,
    addressRecord.addressLocality,
    addressRecord.addressRegion,
    addressRecord.postalCode,
    addressRecord.addressCountry,
  ]
    .map((part) => safeTrim(part))
    .filter((part): part is string => Boolean(part));

  return parts.length ? parts.join(', ') : null;
}

function extractCoordinates(jsonLdPlace: Record<string, unknown> | null): { lat: number; lng: number } | null {
  if (!jsonLdPlace) {
    return null;
  }

  const geo = jsonLdPlace.geo;
  if (!geo || typeof geo !== 'object') {
    return null;
  }

  const geoRecord = geo as Record<string, unknown>;
  const lat = toFiniteNumber(geoRecord.latitude);
  const lng = toFiniteNumber(geoRecord.longitude);
  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
}

function extractPlaceRating(jsonLdPlace: Record<string, unknown> | null): number | null {
  if (!jsonLdPlace) {
    return null;
  }

  const aggregateRating = jsonLdPlace.aggregateRating;
  if (!aggregateRating || typeof aggregateRating !== 'object') {
    return null;
  }

  const rating = toFiniteNumber((aggregateRating as Record<string, unknown>).ratingValue);
  return rating;
}

function extractPlaceReviewCount(jsonLdPlace: Record<string, unknown> | null): number | null {
  if (!jsonLdPlace) {
    return null;
  }

  const aggregateRating = jsonLdPlace.aggregateRating;
  if (!aggregateRating || typeof aggregateRating !== 'object') {
    return null;
  }

  return toInteger((aggregateRating as Record<string, unknown>).reviewCount);
}

function extractPriceLevel(jsonLdPlace: Record<string, unknown> | null): string | null {
  if (!jsonLdPlace) {
    return null;
  }

  const price = jsonLdPlace.priceRange ?? jsonLdPlace.priceLevel;
  return safeTrim(price) ?? null;
}

function stringifyDescription(jsonLdPlace: Record<string, unknown>): string | null {
  const description = jsonLdPlace.description;
  return typeof description === 'string' ? collapseWhitespace(description) : null;
}

function extractTelephone(html: string): string | null {
  const anchors = extractAnchors(html);
  for (const anchor of anchors) {
    const href = safeTrim(anchor.attributes.href);
    if (href?.toLowerCase().startsWith('tel:')) {
      return href.slice(4);
    }
  }

  const candidate = extractAttributeValue(html, 'a', 'href');
  if (candidate?.toLowerCase().startsWith('tel:')) {
    return candidate.slice(4);
  }

  return null;
}

function extractExternalWebsite(html: string): string | null {
  const anchors = extractAnchors(html);
  for (const anchor of anchors) {
    const href = safeTrim(anchor.attributes.href);
    if (!href || href.startsWith('tel:')) {
      continue;
    }

    if (href.includes('google.com/maps') || href.includes('googleusercontent.com')) {
      continue;
    }

    return href;
  }

  const websiteCandidate = extractElementsByAttribute(html, 'data-website', ['a', 'div']);
  if (websiteCandidate.length > 0) {
    return safeTrim(websiteCandidate[0]?.attributes['data-website']) ?? null;
  }

  return null;
}
