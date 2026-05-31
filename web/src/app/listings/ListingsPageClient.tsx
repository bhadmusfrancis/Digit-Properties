'use client';

import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { ListingGrid } from '@/components/listings/ListingGrid';
import type { Listing as ListingGridItem } from '@/components/listings/ListingGrid';
import { ListingFilters } from '@/components/listings/ListingFilters';
import { ListingResultsSortBar } from '@/components/listings/ListingResultsSortBar';
import { FeaturedSlot } from '@/components/listings/FeaturedSlot';
import { isListingSearchSortKey } from '@/lib/listing-search-sort';
import { useUserNearLocation } from '@/lib/use-user-near-location';

type ListingsApiPage = {
  listings?: ListingGridItem[];
  pagination?: { page?: number; pages?: number; total?: number };
};

const AUTO_LOAD_LIMIT = 50;

type ListingsPageClientProps = {
  presetFilters?: Record<string, string>;
  pageTitle?: string;
  pageDescription?: string;
  relatedLinks?: { href: string; label: string }[];
};

function buildBaseQuery(params: URLSearchParams, preset?: Record<string, string>) {
  const q = new URLSearchParams();
  if (preset) {
    for (const [k, v] of Object.entries(preset)) {
      if (v?.trim()) q.set(k, v);
    }
  }
  params.forEach((v, k) => {
    if (!v || k === 'page') return;
    q.set(k, v);
  });
  return q.toString();
}

function ListingsContent({
  presetFilters,
  pageTitle,
  pageDescription,
  relatedLinks,
}: ListingsPageClientProps) {
  const searchParams = useSearchParams();
  const usePresetOnly = Boolean(presetFilters && Object.keys(presetFilters).length > 0);
  const query = usePresetOnly
    ? buildBaseQuery(new URLSearchParams(), presetFilters)
    : buildBaseQuery(searchParams);
  const sortParam = searchParams.get('sort');
  const sortClosest = isListingSearchSortKey(sortParam) && sortParam === 'closest';
  const { location: nearLocation, requestLocation } = useUserNearLocation({ enabled: sortClosest });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (sortClosest) requestLocation();
  }, [sortClosest, requestLocation]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<
    ListingsApiPage,
    Error,
    InfiniteData<ListingsApiPage, number>,
    [string, string, string],
    number
  >({
    queryKey: ['listings', query, sortClosest ? JSON.stringify(nearLocation ?? {}) : ''],
    queryFn: async ({ pageParam }) => {
      const q = new URLSearchParams(query);
      if (pageParam > 1) q.set('page', String(pageParam));
      if (sortClosest && nearLocation) {
        if (nearLocation.suburb) q.set('nearSuburb', nearLocation.suburb);
        if (nearLocation.city) q.set('nearCity', nearLocation.city);
        if (nearLocation.state) q.set('nearState', nearLocation.state);
      }
      const res = await fetch(`/api/listings?${q.toString()}`);
      return (await res.json()) as ListingsApiPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const page = lastPage?.pagination?.page ?? 1;
      const pages = lastPage?.pagination?.pages ?? 1;
      return page < pages ? page + 1 : undefined;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const pages = data?.pages ?? [];
  const listings = pages.flatMap((p) => p?.listings ?? []);
  const total = pages[0]?.pagination?.total as number | undefined;
  const shouldAutoLoad = listings.length < AUTO_LOAD_LIMIT;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage || !shouldAutoLoad) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '480px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, shouldAutoLoad]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">{pageTitle ?? 'Property Listings'}</h1>
      {pageDescription && <p className="mt-2 max-w-3xl text-gray-600">{pageDescription}</p>}
      {relatedLinks && relatedLinks.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700 hover:bg-primary-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
      {!usePresetOnly && <ListingFilters />}
      {!usePresetOnly && (
        <Suspense fallback={null}>
          <ListingResultsSortBar className="mt-4" />
        </Suspense>
      )}
      {usePresetOnly && (
        <p className="mt-4 text-sm text-gray-500">
          <Link href="/listings" className="text-primary-600 hover:underline">
            Browse all Nigeria listings
          </Link>
          {' · '}
          Adjust filters on the main listings page for advanced search.
        </p>
      )}
      <div className="mt-6">
        <FeaturedSlot placement="search" />
      </div>
      {isLoading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-[4/3] bg-gray-200" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <ListingGrid listings={listings} />
          {listings.length === 0 && (
            <div className="mt-12 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
              <p className="text-gray-500">No listings match your filters. Try adjusting your search.</p>
            </div>
          )}
          {listings.length > 0 && (
            <div className="mt-8 flex flex-col items-center gap-3">
              {typeof total === 'number' && total >= 0 && (
                <p className="text-center text-xs text-gray-500">
                  {listings.length.toLocaleString()} of {total.toLocaleString()} listing{total === 1 ? '' : 's'}
                </p>
              )}
              {hasNextPage ? (
                <>
                  {shouldAutoLoad ? (
                    <>
                      <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
                      <p className="text-sm text-gray-500">
                        {isFetchingNextPage ? 'Loading more listings...' : 'Scroll to load more listings'}
                      </p>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="btn-secondary min-w-[140px]"
                    >
                      {isFetchingNextPage ? 'Loading...' : 'Load more'}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">You have reached the end of results.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ListingsPageClient(props: ListingsPageClientProps = {}) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8">Loading...</div>}>
      <ListingsContent {...props} />
    </Suspense>
  );
}
