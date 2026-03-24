import { createIsoTimestamp, safeTrim, toInteger, uniqueStrings } from '../types/shared.js';
import type { ReviewPhotoRecord, ReviewRecord, PlaceRecord } from '../types/shared.js';
import { stableId } from '../utils/ids.js';

export interface ReviewPhotoRecordInput {
  placeId: string;
  placeUrl: string;
  imageUrl: string;
  photoKind?: 'review' | 'place';
  sourceUrl?: string | null;
  reviewId?: string | null;
  reviewUrl?: string | null;
  thumbnailUrl?: string | null;
  altText?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  scrapedAt?: string | null;
  id?: string;
}

export function buildReviewPhotoId(input: Pick<ReviewPhotoRecordInput, 'placeId' | 'reviewId' | 'imageUrl'>): string {
  return stableId([input.placeId, input.reviewId ?? '', input.imageUrl]);
}

export function createReviewPhotoRecord(input: ReviewPhotoRecordInput): ReviewPhotoRecord {
  const placeId = safeTrim(input.placeId) ?? '';
  const placeUrl = safeTrim(input.placeUrl) ?? '';
  const imageUrl = safeTrim(input.imageUrl) ?? '';
  const photoKind = input.photoKind ?? 'review';
  const reviewId = safeTrim(input.reviewId);
  const reviewUrl = safeTrim(input.reviewUrl);
  const thumbnailUrl = safeTrim(input.thumbnailUrl);
  const altText = safeTrim(input.altText);
  const sourceUrl = safeTrim(input.sourceUrl) ?? reviewUrl ?? placeUrl;
  const width = toInteger(input.width);
  const height = toInteger(input.height);
  const id = safeTrim(input.id) ?? buildReviewPhotoId({ placeId, reviewId, imageUrl });

  return {
    id,
    placeId,
    placeUrl,
    reviewId: reviewId ?? null,
    reviewUrl: reviewUrl ?? null,
    photoKind,
    imageUrl,
    thumbnailUrl: thumbnailUrl ?? null,
    altText: altText ?? null,
    width,
    height,
    sourceUrl,
    scrapedAt: safeTrim(input.scrapedAt) ?? createIsoTimestamp(),
  };
}

export function createReviewPhotoRecords(place: PlaceRecord, reviews: ReviewRecord[], imageUrlsByReviewId: Map<string, string[]>): ReviewPhotoRecord[] {
  const reviewMap = new Map(reviews.map((review) => [review.id, review]));
  const records: ReviewPhotoRecord[] = [];

  for (const [reviewId, imageUrls] of imageUrlsByReviewId.entries()) {
    const review = reviewMap.get(reviewId);
    if (!review) {
      continue;
    }

    for (const imageUrl of uniqueStrings(imageUrls)) {
      records.push(
        createReviewPhotoRecord({
          placeId: place.id,
          placeUrl: place.sourceUrl,
          photoKind: 'review',
          reviewId,
          reviewUrl: review.sourceUrl,
          imageUrl,
          sourceUrl: review.sourceUrl,
        })
      );
    }
  }

  return records;
}
