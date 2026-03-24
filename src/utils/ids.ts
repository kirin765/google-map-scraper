import { createHash } from 'node:crypto';

import { normalizeWhitespace } from '../types/shared.js';

export function stableId(parts: Array<string | number | null | undefined>): string {
  const hash = createHash('sha1');

  for (const part of parts) {
    if (part === null || part === undefined) {
      hash.update('\u241f');
      continue;
    }

    const normalized = typeof part === 'string' ? normalizeWhitespace(part) : String(part);
    hash.update(normalized);
    hash.update('\u241f');
  }

  return hash.digest('hex').slice(0, 16);
}

export function slugify(value: string): string {
  const normalized = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized.length > 0 ? normalized : 'item';
}

export function sanitizeFilename(value: string): string {
  return slugify(value).replace(/[^\p{L}\p{N}.-]+/gu, '-');
}

export function joinKeyParts(...parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part === null || part === undefined ? '' : String(part)))
    .join('::');
}
