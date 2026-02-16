'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingFilters } from '@/components/listings/ListingFilters';

function buildQuery(params: URLSearchParams) {
  const q = new URLSearchParams();
  params.forEach((v, k) => {
    if (v) q.set(k, v);
  });
  return q.toString();
}

function ListingsContent() {
  const searchParams = useSearchParams();
  const query = buildQuery(searchParams);

  const { data, isLoading } = useQuery({
    queryKey: ['listings', query],
    queryFn: () => fetch(`/api/listings?${query}`).then((r) => r.json()),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const listings = data?.listings ?? [];
  const pagination = data?.pagination ?? { page: 1, pages: 1 };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Property Listings</h1>
      <ListingFilters />
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
          {pagination.pages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`/listings?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(p) }).toString()}`}
                  className={`rounded px-3 py-1 ${p === pagination.page ? 'bg-primary-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                >
                  {p}
                </a>
              ))}
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
