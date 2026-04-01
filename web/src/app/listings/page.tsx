'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingFilters } from '@/components/listings/ListingFilters';
import { FeaturedSlot } from '@/components/listings/FeaturedSlot';

function buildBaseQuery(params: URLSearchParams) {
  const q = new URLSearchParams();
  params.forEach((v, k) => {
    if (!v || k === 'page') return;
    q.set(k, v);
  });
  return q.toString();
}

function ListingsContent() {
  const searchParams = useSearchParams();
  const query = buildBaseQuery(searchParams);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['listings', query],
    queryFn: async ({ pageParam = 1 }) => {
      const q = new URLSearchParams(query);
      if (pageParam > 1) q.set('page', String(pageParam));
      const res = await fetch(`/api/listings?${q.toString()}`);
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: { pagination?: { page?: number; pages?: number } }) => {
      const page = lastPage?.pagination?.page ?? 1;
      const pages = lastPage?.pagination?.pages ?? 1;
      return page < pages ? page + 1 : undefined;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const pages = data?.pages ?? [];
  const listings = pages.flatMap((p: { listings?: unknown[] }) => p?.listings ?? []);
  const total = pages[0]?.pagination?.total as number | undefined;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return;
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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, listings.length]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Property Listings</h1>
      <ListingFilters />
      <div className="mt-6">
        <FeaturedSlot placement="listings" />
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
                  <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
                  <p className="text-sm text-gray-500">
                    {isFetchingNextPage ? 'Loading more listings...' : 'Scroll to load more listings'}
                  </p>
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

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8">Loading...</div>}>
      <ListingsContent />
    </Suspense>
  );
}
