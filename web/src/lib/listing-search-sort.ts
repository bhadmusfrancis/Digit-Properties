/** Public browse sort options for GET /api/listings and /listings UI. */
export const LISTING_SEARCH_SORT_KEYS = [
  'relevance',
  'closest',
  'price_asc',
  'price_desc',
  'newest',
  'popular',
  'default',
] as const;

export type ListingSearchSortKey = (typeof LISTING_SEARCH_SORT_KEYS)[number];

export const LISTING_SEARCH_SORT_LABELS: Record<ListingSearchSortKey, string> = {
  relevance: 'Relevance',
  closest: 'Closest to me',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest',
  popular: 'Most popular',
  default: 'Recommended',
};

export function isListingSearchSortKey(value: string | null | undefined): value is ListingSearchSortKey {
  return Boolean(value && (LISTING_SEARCH_SORT_KEYS as readonly string[]).includes(value));
}

/** Pick a sensible default when the user has not chosen a sort explicitly. */
export function defaultListingSearchSort(hasQuery: boolean): ListingSearchSortKey {
  return hasQuery ? 'relevance' : 'default';
}
