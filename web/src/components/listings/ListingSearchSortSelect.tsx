'use client';

import {
  LISTING_SEARCH_SORT_KEYS,
  LISTING_SEARCH_SORT_LABELS,
  type ListingSearchSortKey,
  isListingSearchSortKey,
} from '@/lib/listing-search-sort';

type Props = {
  value: ListingSearchSortKey;
  onChange: (sort: ListingSearchSortKey) => void;
  /** Compact styling for header placement. */
  compact?: boolean;
  id?: string;
  className?: string;
};

export function ListingSearchSortSelect({
  value,
  onChange,
  compact = false,
  id = 'listing-search-sort',
  className = '',
}: Props) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (isListingSearchSortKey(next)) onChange(next);
      }}
      aria-label="Sort listings"
      className={
        compact
          ? `rounded-full border-0 bg-transparent py-1 pl-2 pr-7 text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-400 sm:text-sm ${className}`
          : `input max-w-xs text-sm ${className}`
      }
    >
      {LISTING_SEARCH_SORT_KEYS.map((key) => (
        <option key={key} value={key}>
          {LISTING_SEARCH_SORT_LABELS[key]}
        </option>
      ))}
    </select>
  );
}
