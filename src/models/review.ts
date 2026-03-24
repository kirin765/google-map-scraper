import { createIsoTimestamp, normalizeWhitespace, safeTrim, toFiniteNumber, toInteger, uniqueStrings } from '../types/shared.js';
import type { ReviewRecord, PlaceRecord } from '../types/shared.js';
import { stableId } from '../utils/ids.js';

export interface ReviewRecordInput {
  placeId: string;
  placeUrl: string;
  sourceUrl: string;
  authorName?: string | null;
  authorProfileUrl?: string | null;
  rating?: number | string | null;
  publishedAt?: string | null;
  text?: string | null;
  translatedText?: string | null;
  likes?: number | string | null;
  photoIds?: string[];
  rawLabel?: string | null;
  scrapedAt?: string | null;
  id?: string;
}

export function buildReviewId(input: Pick<ReviewRecordInput, 'placeId' | 'sourceUrl' | 'authorName' | 'publishedAt' | 'text'>): string {
  return stableId([input.placeId, input.sourceUrl, input.authorName, input.publishedAt, input.text]);
}

export function createReviewRecord(input: ReviewRecordInput): ReviewRecord {
  const placeId = safeTrim(input.placeId) ?? '';
  const placeUrl = safeTrim(input.placeUrl) ?? '';
  const sourceUrl = safeTrim(input.sourceUrl) ?? placeUrl;
  const authorName = safeTrim(input.authorName);
  const authorProfileUrl = safeTrim(input.authorProfileUrl);
  const rating = toFiniteNumber(input.rating);
  const publishedAt = safeTrim(input.publishedAt);
  const text = normalizeOptionalText(input.text);
  const translatedText = normalizeOptionalText(input.translatedText);
  const likes = toInteger(input.likes);
  const rawLabel = safeTrim(input.rawLabel);
  const photoIds = uniqueStrings(input.photoIds ?? []);
  const id = safeTrim(input.id) ?? buildReviewId({ placeId, sourceUrl, authorName, publishedAt, text });

  return {
    id,
    placeId,
    placeUrl,
    authorName: authorName ?? null,
    authorProfileUrl: authorProfileUrl ?? null,
    rating,
    publishedAt: publishedAt ?? null,
    text,
    translatedText,
    likes,
    sourceUrl,
    photoIds,
    scrapedAt: safeTrim(input.scrapedAt) ?? createIsoTimestamp(),
    rawLabel: rawLabel ?? null,
  };
}

export function createReviewRecords(place: PlaceRecord, records: ReviewRecordInput[]): ReviewRecord[] {
  return records.map((record) =>
    createReviewRecord({
      placeId: place.id,
      placeUrl: place.sourceUrl,
      sourceUrl: record.sourceUrl,
      authorName: record.authorName,
      authorProfileUrl: record.authorProfileUrl,
      rating: record.rating,
      publishedAt: record.publishedAt,
      text: record.text,
      translatedText: record.translatedText,
      likes: record.likes,
      photoIds: record.photoIds,
      rawLabel: record.rawLabel,
      scrapedAt: record.scrapedAt,
      id: record.id,
    })
  );
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = safeTrim(value);
  return trimmed ? normalizeWhitespace(trimmed) : null;
}
