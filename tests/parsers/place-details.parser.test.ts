import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { extractPlaceDetailsFromHtml } from '../../src/scrapers/place-details.js';
import type { SearchResultItem } from '../../src/types/shared.js';

test('extracts place metadata from fixture HTML', async () => {
  const html = await readFile(new URL('../../../tests/fixtures/place-details.fixture.html', import.meta.url), 'utf8');
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

  const place = extractPlaceDetailsFromHtml(html, searchResult);

  assert.equal(place.name, 'Blue Lagoon');
  assert.equal(place.category, 'Cafe');
  assert.equal(place.address, '123 Example St, Seoul, Seoul, KR');
  assert.deepEqual(place.coordinates, { lat: 37.1234, lng: 127.1234 });
  assert.equal(place.rating, 4.6);
  assert.equal(place.reviewCount, 128);
  assert.equal(place.priceLevel, '$$');
  assert.equal(place.website, 'https://blue-lagoon.example.com');
  assert.equal(place.phone, '+82-2-1234-5678');
});
