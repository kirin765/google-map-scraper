import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createScrapeJob } from '../../src/models/job.js';
import { resolveCheckpoint } from '../../src/pipelines/scrape-region-keywords.js';
import type { CheckpointState } from '../../src/types/shared.js';

test('resolveCheckpoint ignores existing checkpoint unless resume is enabled', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'google-map-scraper-'));

  try {
    const checkpointPath = join(tempDir, 'checkpoint.json');
    const existingCheckpoint: CheckpointState = {
      version: 1,
      region: 'Seoul',
      keywords: ['cafe'],
      nextKeywordIndex: 1,
      nextPlaceIndexByKeyword: { cafe: 3 },
      completedPlaceIds: ['place-a'],
      updatedAt: '2026-03-24T00:00:00.000Z',
    };

    await writeFile(checkpointPath, JSON.stringify(existingCheckpoint), 'utf8');

    const job = createScrapeJob({
      keywords: ['cafe'],
      region: 'Seoul',
      outputDir: tempDir,
      outputFormat: 'ndjson',
      resume: false,
    });

    const resolved = await resolveCheckpoint(job, checkpointPath);

    assert.deepEqual(resolved.completedKeywords, []);
    assert.equal(resolved.activeKeyword, null);
    assert.equal(resolved.checkpoint.nextKeywordIndex, 0);
    assert.deepEqual(resolved.checkpoint.completedPlaceIds, []);
    assert.deepEqual(resolved.checkpoint.nextPlaceIndexByKeyword, {});
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveCheckpoint preserves completed keywords while allowing reordered keyword lists', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'google-map-scraper-'));

  try {
    const checkpointPath = join(tempDir, 'checkpoint.json');
    const existingCheckpoint: CheckpointState = {
      version: 1,
      region: 'Seoul',
      keywords: ['restaurant', 'cafe'],
      nextKeywordIndex: 1,
      nextPlaceIndexByKeyword: { restaurant: 10, cafe: 2 },
      completedPlaceIds: ['place-1'],
      updatedAt: '2026-03-24T00:00:00.000Z',
    };

    await writeFile(checkpointPath, JSON.stringify(existingCheckpoint), 'utf8');

    const job = createScrapeJob({
      keywords: ['cafe', 'restaurant'],
      region: 'Seoul',
      outputDir: tempDir,
      outputFormat: 'ndjson',
      resume: true,
    });

    const resolved = await resolveCheckpoint(job, checkpointPath);

    assert.deepEqual(resolved.completedKeywords, ['restaurant']);
    assert.equal(resolved.activeKeyword, 'cafe');
    assert.deepEqual(resolved.checkpoint.keywords, ['cafe', 'restaurant']);
    assert.equal(resolved.checkpoint.nextKeywordIndex, 0);
    assert.equal(resolved.checkpoint.nextPlaceIndexByKeyword.cafe, 2);
    assert.equal(resolved.checkpoint.nextPlaceIndexByKeyword.restaurant, 10);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
