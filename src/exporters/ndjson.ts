import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ExportRecord, ScrapeRunResult } from '../types/shared.js';

export function toNdjsonRecords(result: ScrapeRunResult): ExportRecord[] {
  return [
    {
      type: 'run',
      data: {
        job: result.job,
        checkpoint: result.checkpoint,
        searchResultCount: result.searchResults.length,
        placeCount: result.places.length,
        reviewCount: result.reviews.length,
        photoCount: result.photos.length,
      },
    },
    ...result.places.map((data) => ({ type: 'place' as const, data })),
    ...result.reviews.map((data) => ({ type: 'review' as const, data })),
    ...result.photos.map((data) => ({ type: 'review-photo' as const, data })),
  ];
}

export function serializeNdjsonRecord(record: ExportRecord): string {
  return `${JSON.stringify(record)}\n`;
}

export function serializeNdjsonExport(result: ScrapeRunResult): string {
  return toNdjsonRecords(result)
    .map((record) => serializeNdjsonRecord(record))
    .join('');
}

export async function writeNdjsonExport(filePath: string, result: ScrapeRunResult): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeNdjsonExport(result), 'utf8');
}
