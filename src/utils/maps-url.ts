export function normalizeComparableUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://www.google.com');
    const pathname = parsed.pathname.replace(/\/+$/g, '');
    return `${parsed.origin}${pathname}`;
  } catch {
    return url.replace(/[?#].*$/g, '').replace(/\/+$/g, '');
  }
}

export function isSameUrlLocation(left: string, right: string): boolean {
  return normalizeComparableUrl(left) === normalizeComparableUrl(right);
}

export function isSameGoogleMapsPlaceUrl(left: string, right: string): boolean {
  return isSameUrlLocation(left, right);
}
