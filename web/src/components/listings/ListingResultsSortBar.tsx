'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ListingSearchSortSelect } from '@/components/listings/ListingSearchSortSelect';
import {
  defaultListingSearchSort,
  isListingSearchSortKey,
  type ListingSearchSortKey,
} from '@/lib/listing-search-sort';
import { useUserNearLocation } from '@/lib/use-user-near-location';

type Props = {
  className?: string;
};

export function ListingResultsSortBar({ className = '' }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasQuery = Boolean(searchParams.get('q')?.trim());
  const currentSortParam = searchParams.get('sort');
  const sort: ListingSearchSortKey = isListingSearchSortKey(currentSortParam)
    ? currentSortParam
    : defaultListingSearchSort(hasQuery);

  const needsLocation = sort === 'closest';
  const { status: locationStatus, requestLocation } = useUserNearLocation({ enabled: needsLocation });

  function applySort(nextSort: ListingSearchSortKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (nextSort === 'default' && !hasQuery) params.delete('sort');
    else if (nextSort === 'default' && hasQuery) params.set('sort', 'relevance');
    else params.set('sort', nextSort);
    router.push(`/listings?${params.toString()}`);
    if (nextSort === 'closest') requestLocation();
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Sort by</span>
        <ListingSearchSortSelect value={sort} onChange={applySort} id="listings-results-sort" />
      </div>
      {sort === 'closest' && locationStatus === 'loading' && (
        <p className="text-xs text-gray-500">Detecting your location…</p>
      )}
      {sort === 'closest' && locationStatus === 'unavailable' && (
        <p className="text-xs text-amber-700">
          Location unavailable — showing recommended order. Enable location or pick another sort.
        </p>
      )}
    </div>
  );
}
