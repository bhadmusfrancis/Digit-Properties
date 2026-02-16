'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ListingGrid } from './ListingGrid';

async function fetchListings() {
  const res = await fetch(`/api/listings?limit=8&_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export function FeaturedListings() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['listings', 'featured'],
    queryFn: fetchListings,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="aspect-[4/3] bg-gray-200" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-4 w-1/2 rounded bg-gray-200" />
              <div className="h-3 w-1/3 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const listings = data?.listings ?? [];

  if (isError) {
    return (
      <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 py-16 text-center">
        <p className="text-red-600">Failed to load listings: {(error as Error)?.message}</p>
      </div>
    );
  }

  return (
    <>
      <ListingGrid listings={listings} />
      {listings.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <p className="text-gray-500">No listings yet. Be the first to list a property!</p>
          <Link href="/auth/signup" className="mt-4 inline-block text-primary-600 font-medium hover:underline">
            Sign up to list
          </Link>
        </div>
      )}
    </>
  );
}
