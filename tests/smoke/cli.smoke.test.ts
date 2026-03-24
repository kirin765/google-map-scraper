import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCliArgs, printCliUsage } from '../../src/cli/args.js';
import { createScrapeJob } from '../../src/models/job.js';

test('parses CLI arguments into a job description', () => {
  const parsed = parseCliArgs([
    '--keywords',
    'cafe,restaurant',
    '--region',
    'Seoul, South Korea',
    '--output',
    'output',
    '--format',
    'ndjson',
    '--max-places',
    '5',
    '--max-reviews',
    '3',
    '--dry-run',
  ]);

  assert.deepEqual(parsed.keywords, ['cafe', 'restaurant']);
  assert.equal(parsed.region, 'Seoul, South Korea');
  assert.equal(parsed.dryRun, true);

  const job = createScrapeJob({
    keywords: parsed.keywords,
    region: parsed.region ?? 'Seoul, South Korea',
    outputDir: 'output',
    outputFormat: 'ndjson',
    maxPlacesPerKeyword: 5,
    maxReviewsPerPlace: 3,
    dryRun: parsed.dryRun,
  });

  assert.deepEqual(job.keywords, ['cafe', 'restaurant']);
  assert.equal(job.region, 'Seoul, South Korea');
  assert.equal(job.outputFormat, 'ndjson');
  assert.equal(job.maxPlacesPerKeyword, 5);
  assert.equal(job.maxReviewsPerPlace, 3);
  assert.equal(job.dryRun, true);
});

test('prints usage text', () => {
  const usage = printCliUsage();
  assert.match(usage, /--keywords/);
  assert.match(usage, /--dry-run/);
});
