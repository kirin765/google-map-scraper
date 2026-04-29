import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { createIsoTimestamp, uniqueStrings } from '../types/shared.js';
import type { CheckpointState, ScrapeJobInput } from '../types/shared.js';

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export function createCheckpointState(job: Pick<ScrapeJobInput, 'region' | 'keywords'>): CheckpointState {
  return {
    version: 1,
    region: job.region,
    keywords: [...job.keywords],
    nextKeywordIndex: 0,
    nextPlaceIndexByKeyword: {},
    completedPlaceIds: [],
    updatedAt: createIsoTimestamp(),
  };
}

export function normalizeCheckpointState(state: CheckpointState): CheckpointState {
  return {
    version: 1,
    region: state.region,
    keywords: [...state.keywords],
    nextKeywordIndex: Math.max(0, Math.trunc(state.nextKeywordIndex)),
    nextPlaceIndexByKeyword: Object.fromEntries(
      Object.entries(state.nextPlaceIndexByKeyword).map(([keyword, index]) => [keyword, Math.max(0, Math.trunc(index))])
    ),
    completedPlaceIds: uniqueStrings(state.completedPlaceIds),
    updatedAt: state.updatedAt,
  };
}

export function advanceKeywordCheckpoint(state: CheckpointState, nextKeywordIndex: number): CheckpointState {
  return normalizeCheckpointState({
    ...state,
    nextKeywordIndex,
    updatedAt: createIsoTimestamp(),
  });
}

export function markPlaceCheckpoint(state: CheckpointState, keyword: string, nextPlaceIndex: number, placeId?: string): CheckpointState {
  return normalizeCheckpointState({
    ...state,
    nextPlaceIndexByKeyword: {
      ...state.nextPlaceIndexByKeyword,
      [keyword]: nextPlaceIndex,
    },
    completedPlaceIds: placeId ? uniqueStrings([...state.completedPlaceIds, placeId]) : [...state.completedPlaceIds],
    updatedAt: createIsoTimestamp(),
  });
}

export async function loadCheckpoint(filePath: string): Promise<CheckpointState | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (parsed['version'] !== 1 || typeof parsed['region'] !== 'string' || !Array.isArray(parsed['keywords'])) {
      throw new Error('Checkpoint file is invalid or from an incompatible version');
    }

    return normalizeCheckpointState(parsed as unknown as CheckpointState);
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

export async function saveCheckpoint(filePath: string, state: CheckpointState): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalizeCheckpointState(state), null, 2)}\n`, 'utf8');
}

export async function clearCheckpoint(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }
}
