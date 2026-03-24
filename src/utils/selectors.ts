export const GOOGLE_MAPS_PLACE_URL_RE = /(?:https?:\/\/(?:www\.)?google\.[^/]+)?\/maps\/place\//i;
export const GOOGLE_MAPS_REVIEW_URL_RE = /(?:https?:\/\/(?:www\.)?google\.[^/]+)?\/maps\/review/i;

export const SEARCH_RESULT_CANDIDATE_SELECTORS = [
  'a[href*="/maps/place/"]',
  'a[href^="/maps/place/"]',
  'a[href*="google.com/maps/place/"]',
];

export const PLACE_TITLE_CANDIDATE_SELECTORS = [
  'h1',
  '[data-testid="hero-title"]',
  '[aria-label][role="img"]',
];

export const REVIEW_CARD_CANDIDATE_SELECTORS = [
  'article[data-review-id]',
  'div[data-review-id]',
  'li[data-review-id]',
  '[data-review-id]',
];

export const REVIEW_PHOTO_CANDIDATE_SELECTORS = [
  'img[data-photo-url]',
  'img[data-src]',
  'img[src*="googleusercontent.com"]',
  'a[href*="googleusercontent.com"]',
];

export function firstSelector(selectors: string[]): string | null {
  return selectors.length > 0 ? (selectors[0] ?? null) : null;
}

export function isGoogleMapsPlaceUrl(url: string): boolean {
  return GOOGLE_MAPS_PLACE_URL_RE.test(url);
}

export function isGoogleMapsReviewUrl(url: string): boolean {
  return GOOGLE_MAPS_REVIEW_URL_RE.test(url);
}
