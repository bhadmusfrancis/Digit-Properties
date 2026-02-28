'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { ListingCarousel } from './ListingCarousel';

const SHUFFLE_INTERVAL_MS = 10_000;
const AUTO_SCROLL_INTERVAL_MS = 10_000;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function fetchListings() {
  const res = await fetch(`/api/listings?featured=1&limit=12&random=1&_t=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || res.statusText || 'Failed to fetch');
  return data as { listings?: unknown[]; pagination?: unknown };
}

export function FeaturedListings() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['listings', 'featured'],
    queryFn: fetchListings,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const rawListings = useMemo(() => (data?.listings ?? []) as unknown[], [data?.listings]);
  const [displayListings, setDisplayListings] = useState(rawListings);

  useEffect(() => {
    if (rawListings.length === 0) return;
    setDisplayListings(rawListings);
  }, [rawListings]);

  useEffect(() => {
    if (rawListings.length <= 1) return;
    const id = setInterval(() => setDisplayListings((prev) => shuffle(prev)), SHUFFLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [rawListings.length]);

  if (isLoading) {
    return (
      <div className="mt-6 flex gap-4 overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card min-w-[280px] max-w-[280px] flex-shrink-0 animate-pulse">
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

  if (isError) {
    return (
      <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 py-16 text-center">
        <p className="text-red-600">Failed to load listings: {(error as Error)?.message}</p>
      </div>
    );
  }

  return (
    <>
      <ListingCarousel
        listings={displayListings}
        autoScrollIntervalMs={AUTO_SCROLL_INTERVAL_MS}
      />
      {displayListings.length === 0 && (
        <div className="mt-6 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <p className="text-gray-500">No listings yet. Be the first to Add a property!</p>
          <Link href="/auth/signup" className="mt-4 inline-block text-primary-600 font-medium hover:underline">
            Sign up to list
          </Link>
        </div>
      )}
    </>
  );
}
