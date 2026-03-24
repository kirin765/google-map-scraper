import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ScrapeRunResult } from '../types/shared.js';

export interface JsonExportPayload extends ScrapeRunResult {}

export function buildJsonExportPayload(result: ScrapeRunResult): JsonExportPayload {
  return {
    job: result.job,
    searchResults: [...result.searchResults],
    places: [...result.places],
    reviews: [...result.reviews],
    photos: [...result.photos],
    checkpoint: result.checkpoint,
  };
}

export function serializeJsonExport(result: ScrapeRunResult): string {
  return `${JSON.stringify(buildJsonExportPayload(result), null, 2)}\n`;
}

export async function writeJsonExport(filePath: string, result: ScrapeRunResult): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeJsonExport(result), 'utf8');
}
