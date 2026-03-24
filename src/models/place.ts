import { createIsoTimestamp, firstNonNullish, safeTrim, toFiniteNumber, toInteger, uniqueStrings } from '../types/shared.js';
import type { GeoCoordinates, PlaceRecord, SearchResultItem, ScrapeJobInput } from '../types/shared.js';
import { slugify, stableId } from '../utils/ids.js';

export interface PlaceRecordInput {
  searchResultId: string;
  searchKeyword: string;
  region: string;
  name: string;
  sourceUrl: string;
  searchUrl: string;
  keywords?: string[];
  id?: string;
  category?: string | null;
  address?: string | null;
  coordinates?: GeoCoordinates | null;
  rating?: number | string | null;
  reviewCount?: number | string | null;
  priceLevel?: string | null;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
  rawTitle?: string | null;
  rawLabel?: string | null;
  scrapedAt?: string | null;
  rawHtml?: string | null;
}

export function buildPlaceId(input: Pick<PlaceRecordInput, 'searchResultId' | 'searchKeyword' | 'region' | 'name' | 'sourceUrl'>): string {
  return stableId([input.sourceUrl, input.name, input.region]);
}

export function createPlaceRecord(input: PlaceRecordInput): PlaceRecord {
  const name = safeTrim(input.name) ?? 'Unknown place';
  const searchKeyword = safeTrim(input.searchKeyword) ?? 'unknown';
  const region = safeTrim(input.region) ?? 'unknown';
  const sourceUrl = safeTrim(input.sourceUrl) ?? '';
  const searchUrl = safeTrim(input.searchUrl) ?? sourceUrl;
  const rawTitle = safeTrim(input.rawTitle);
  const rawLabel = safeTrim(input.rawLabel);
  const keywords = uniqueStrings(input.keywords ?? [searchKeyword, region, name]);

  const coordinates = normalizeCoordinates(input.coordinates);
  const rating = toFiniteNumber(input.rating);
  const reviewCount = toInteger(input.reviewCount);
  const priceLevel = safeTrim(input.priceLevel);
  const phone = safeTrim(input.phone);
  const website = safeTrim(input.website);
  const description = safeTrim(input.description);
  const id = safeTrim(input.id) ?? buildPlaceId({ ...input, name, sourceUrl });

  return {
    id,
    searchResultId: safeTrim(input.searchResultId) ?? id,
    searchKeyword,
    region,
    name,
    category: safeTrim(input.category),
    address: safeTrim(input.address),
    coordinates,
    rating,
    reviewCount,
    priceLevel: priceLevel ?? null,
    phone: phone ?? null,
    website: website ?? null,
    description: description ?? null,
    sourceUrl,
    searchUrl,
    rawTitle: rawTitle ?? null,
    rawLabel: rawLabel ?? null,
    keywords,
    scrapedAt: safeTrim(input.scrapedAt) ?? createIsoTimestamp(),
    ...(safeTrim(input.rawHtml) ? { rawHtml: safeTrim(input.rawHtml) ?? undefined } : {}),
  };
}

export function derivePlaceNameFromSearchResult(searchResult: SearchResultItem): string {
  return safeTrim(searchResult.title) ?? 'Unknown place';
}

export function describePlace(place: PlaceRecord): string {
  return [place.name, place.category, place.region].filter(Boolean).join(' · ');
}

export function createPlaceFromSearchResult(
  searchResult: SearchResultItem,
  input: Partial<Omit<PlaceRecordInput, 'searchResultId' | 'searchKeyword' | 'region' | 'name' | 'sourceUrl' | 'searchUrl'>> = {}
): PlaceRecord {
  return createPlaceRecord({
    searchResultId: searchResult.id,
    searchKeyword: searchResult.keyword,
    region: searchResult.region,
    name: derivePlaceNameFromSearchResult(searchResult),
    sourceUrl: searchResult.placeUrl,
    searchUrl: searchResult.placeUrl,
    category: searchResult.category,
    rating: firstNonNullish(searchResult.rating, input.rating),
    reviewCount: firstNonNullish(searchResult.reviewCount, input.reviewCount),
    rawLabel: searchResult.rawLabel,
    ...input,
  });
}

export function createDefaultPlaceRecord(job: Pick<ScrapeJobInput, 'keywords' | 'region'>, searchResult: SearchResultItem): PlaceRecord {
  return createPlaceFromSearchResult(searchResult, {
    keywords: uniqueStrings([searchResult.keyword, job.region, ...job.keywords]),
  });
}

function normalizeCoordinates(value: GeoCoordinates | null | undefined): GeoCoordinates | null {
  if (!value) {
    return null;
  }

  const lat = toFiniteNumber(value.lat);
  const lng = toFiniteNumber(value.lng);
  if (lat === null || lng === null) {
    return null;
  }

  return {
    lat,
    lng,
  };
}

export function placeKeySlug(place: Pick<PlaceRecord, 'name' | 'region'>): string {
  return slugify(`${place.region}-${place.name}`);
}
