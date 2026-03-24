import { clampNumber, normalizeWhitespace, safeTrim, toFiniteNumber } from '../types/shared.js';

export interface HtmlTag {
  tagName: string;
  attributes: Record<string, string>;
  innerHtml: string;
  text: string;
  raw: string;
}

export interface JsonLdEntry {
  raw: string;
  value: unknown;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

export function collapseWhitespace(value: string): string {
  return normalizeWhitespace(decodeHtmlEntities(stripHtmlTags(value)));
}

export function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributeSource = source
    .replace(/^<\s*\/?\s*[^\s>]+\s*/i, '')
    .replace(/\/?>\s*$/i, '');
  const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(attributeSource)) !== null) {
    const [, rawName, doubleQuoted, singleQuoted, unquoted] = match;
    const name = (rawName ?? '').toLowerCase();
    if (!name) {
      continue;
    }
    const rawValue = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
    attributes[name] = decodeHtmlEntities(rawValue);
  }

  return attributes;
}

export function extractElementsByTag(html: string, tagName: string): HtmlTag[] {
  const elements: HtmlTag[] = [];
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b([^>]*)>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}\\s*>`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const raw = match[0];
    const openTag = `<${tagName}${match[1]}>`;
    const attributes = parseAttributes(openTag);
    const innerHtml = match[2] ?? '';
    elements.push({
      tagName,
      attributes,
      innerHtml,
      text: collapseWhitespace(innerHtml),
      raw,
    });
  }

  return elements;
}

export function extractElementsByAttribute(
  html: string,
  attributeName: string,
  tagNames: string[] = ['article', 'div', 'li']
): HtmlTag[] {
  const attribute = attributeName.toLowerCase();
  const elements: HtmlTag[] = [];

  for (const tagName of tagNames) {
    for (const element of extractElementsByTag(html, tagName)) {
      if (element.attributes[attribute] !== undefined) {
        elements.push(element);
      }
    }
  }

  return elements;
}

export function extractAnchors(html: string): HtmlTag[] {
  return extractElementsByTag(html, 'a').filter((element) => element.attributes.href !== undefined);
}

export function extractMetaContent(
  html: string,
  criteria: Array<{ name?: string; property?: string; itemprop?: string }>
): string | null {
  const metaPattern = /<meta\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaPattern.exec(html)) !== null) {
    const attributes = parseAttributes(`<meta${match[1]}>`);
    const matches = criteria.some((criterion) => {
      const name = safeTrim(attributes.name);
      const property = safeTrim(attributes.property);
      const itemprop = safeTrim(attributes.itemprop);

      return (
        (criterion.name !== undefined && name === criterion.name) ||
        (criterion.property !== undefined && property === criterion.property) ||
        (criterion.itemprop !== undefined && itemprop === criterion.itemprop)
      );
    });

    if (!matches) {
      continue;
    }

    const content = safeTrim(attributes.content);
    if (content) {
      return decodeHtmlEntities(content);
    }
  }

  return null;
}

export function extractLinkHref(html: string, rel: string): string | null {
  const linkPattern = /<link\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const attributes = parseAttributes(`<link${match[1]}>`);
    if (safeTrim(attributes.rel)?.toLowerCase() !== rel.toLowerCase()) {
      continue;
    }

    const href = safeTrim(attributes.href);
    if (href) {
      return decodeHtmlEntities(href);
    }
  }

  return null;
}

export function extractJsonLdObjects(html: string): unknown[] {
  const results: unknown[] = [];
  const scriptPattern = /<script\b([^>]*)type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html)) !== null) {
    const raw = match[2]?.trim();
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      // Ignore malformed JSON-LD blocks and keep parsing other candidates.
    }
  }

  return results;
}

export function extractTextBetweenTags(html: string, tagName: string): string | null {
  const elements = extractElementsByTag(html, tagName);
  if (elements.length === 0) {
    return null;
  }

  return elements[0] ? elements[0].text : null;
}

export function extractAttributeValue(html: string, tagName: string, attributeName: string): string | null {
  const elements = extractElementsByTag(html, tagName);
  for (const element of elements) {
    const value = safeTrim(element.attributes[attributeName.toLowerCase()]);
    if (value) {
      return decodeHtmlEntities(value);
    }
  }

  return null;
}

export function toNumberAttribute(value: unknown, min?: number, max?: number): number | null {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return null;
  }

  if (min !== undefined && max !== undefined) {
    return clampNumber(numeric, min, max);
  }

  if (min !== undefined) {
    return Math.max(numeric, min);
  }

  if (max !== undefined) {
    return Math.min(numeric, max);
  }

  return numeric;
}

export function extractImageTags(html: string): HtmlTag[] {
  const imagePattern = /<img\b([^>]*)>/gi;
  const images: HtmlTag[] = [];
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(html)) !== null) {
    const raw = match[0];
    const attributes = parseAttributes(raw);
    images.push({
      tagName: 'img',
      attributes,
      innerHtml: '',
      text: '',
      raw,
    });
  }

  return images;
}
