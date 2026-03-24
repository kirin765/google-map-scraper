import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isSameGoogleMapsPlaceUrl, normalizeComparableUrl } from '../../src/utils/maps-url.js';

test('normalizes comparable Google Maps URLs by stripping query and hash differences', () => {
  const normalized = normalizeComparableUrl(
    'https://www.google.com/maps/place/Blue+Lagoon/@37.1234,127.1234,17z/data=!3m1!4b1?authuser=0#reviews'
  );

  assert.equal(
    normalized,
    'https://www.google.com/maps/place/Blue+Lagoon/@37.1234,127.1234,17z/data=!3m1!4b1'
  );
});

test('treats equivalent Google Maps place URLs as the same location', () => {
  assert.equal(
    isSameGoogleMapsPlaceUrl(
      'https://www.google.com/maps/place/Blue+Lagoon/@37.1234,127.1234,17z/data=!3m1!4b1?authuser=0',
      'https://www.google.com/maps/place/Blue+Lagoon/@37.1234,127.1234,17z/data=!3m1!4b1#reviews'
    ),
    true
  );

  assert.equal(
    isSameGoogleMapsPlaceUrl(
      'https://www.google.com/maps/place/Blue+Lagoon/@37.1234,127.1234,17z/data=!3m1!4b1',
      'https://www.google.com/maps/place/Seoul+Tower/@37.5555,126.9999,17z/data=!3m1!4b1'
    ),
    false
  );
});
