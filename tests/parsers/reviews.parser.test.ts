import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { createPlaceFromSearchResult } from '../../src/models/place.js';
import { extractReviewPhotosFromHtml } from '../../src/scrapers/review-photos.js';
import { extractReviewsFromHtml } from '../../src/scrapers/reviews.js';
import type { SearchResultItem } from '../../src/types/shared.js';

test('extracts reviews and review photos from fixture HTML', async () => {
  const html = await readFile(new URL('../../../tests/fixtures/reviews.fixture.html', import.meta.url), 'utf8');
  const searchResult: SearchResultItem = {
    id: 'search-result-1',
    keyword: 'cafe',
    region: 'Seoul',
    title: 'Blue Lagoon',
    placeUrl: 'https://www.google.com/maps/place/Blue+Lagoon/@37.1234,127.1234,17z/data=!3m1!4b1',
    category: 'Cafe',
    rating: 4.6,
    reviewCount: 128,
    snippet: null,
    rank: 1,
    rawLabel: 'Blue Lagoon · Cafe · 4.6 stars · 128 reviews',
    scrapedAt: '2026-03-24T00:00:00.000Z',
  };
  const place = createPlaceFromSearchResult(searchResult);

  const reviews = extractReviewsFromHtml(html, place);
  assert.equal(reviews.length, 2);
  assert.equal(reviews[0]?.authorName, 'Jane Doe');
  assert.equal(reviews[0]?.rating, 4.9);
  assert.equal(reviews[0]?.photoIds.length, 2);
  assert.equal(reviews[0]?.photoIds.includes('https://lh3.googleusercontent.com/profile-jane.jpg' as never), false);
  assert.equal(reviews[1]?.authorName, 'Min');
  assert.equal(reviews[1]?.rating, 4.5);

  const photos = extractReviewPhotosFromHtml(html, place, reviews);
  assert.equal(photos.length, 3);
  assert.equal(photos[0]?.placeId, place.id);
  assert.equal(photos[0]?.imageUrl, 'https://lh3.googleusercontent.com/photo-a.jpg');
  assert.equal(photos[0]?.photoKind, 'review');
  assert.equal(photos[1]?.imageUrl, 'https://lh3.googleusercontent.com/photo-b.jpg');
  assert.equal(photos[1]?.photoKind, 'review');
  assert.equal(photos[2]?.imageUrl, 'https://lh3.googleusercontent.com/place-hero.jpg');
  assert.equal(photos[2]?.photoKind, 'place');
  assert.equal(photos.some((photo) => photo.imageUrl === 'https://lh3.googleusercontent.com/profile-jane.jpg'), false);
});
