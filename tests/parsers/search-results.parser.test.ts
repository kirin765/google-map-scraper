import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { extractSearchResultsFromHtml } from '../../src/scrapers/search-results.js';

test('extracts search results from fixture HTML', async () => {
  const html = await readFile(new URL('../../../tests/fixtures/search-results.fixture.html', import.meta.url), 'utf8');
  const results = extractSearchResultsFromHtml(html, {
    keyword: 'cafe',
    region: 'Seoul',
    limit: 10,
  });

  assert.equal(results.length, 2);
  assert.equal(results[0]?.title, 'Blue Lagoon');
  assert.equal(results[0]?.category, 'Cafe');
  assert.equal(results[0]?.rating, 4.6);
  assert.equal(results[0]?.reviewCount, 128);
  assert.match(results[0]?.placeUrl ?? '', /Blue\+Lagoon/);
  assert.equal(results[1]?.title, 'Seoul Tower');
  assert.equal(results[1]?.category, 'Tourist attraction');
  assert.equal(results[1]?.rating, 4.8);
  assert.equal(results[1]?.reviewCount, 9120);
});
