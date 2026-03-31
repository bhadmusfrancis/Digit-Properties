'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ListingGrid } from './ListingGrid';

const TRENDING_FIRST_PAGE = 8;
const TRENDING_MAX = 40;

type LocationParams = { suburb?: string; city?: string; state?: string } | null;

type ListingRow = {
  _id: string;
  title: string;
  price: number;
  listingType: string;
  rentPeriod?: 'day' | 'month' | 'year';
  propertyType: string;
  location: { city?: string; state?: string; suburb?: string };
  bedrooms: number;
  bathrooms: number;
  toilets?: number;
  images?: { url: string }[];
  videos?: { url: string; public_id?: string }[];
  isBoosted?: boolean;
  createdBy?: { name?: string; role?: string };
};

async function fetchTrending(location: LocationParams, offset: number) {
  const remaining = TRENDING_MAX - offset;
  if (remaining <= 0) return { listings: [] as ListingRow[] };

  const take = offset === 0 ? TRENDING_FIRST_PAGE : Math.min(TRENDING_FIRST_PAGE, remaining);
  const params = new URLSearchParams({
    limit: String(take),
    offset: String(offset),
  });
  if (location?.suburb) params.set('suburb', location.suburb);
  if (location?.city) params.set('city', location.city);
  if (location?.state) params.set('state', location.state);
  const res = await fetch(`/api/listings/trending?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || res.statusText || 'Failed to fetch');
  return data as { listings?: ListingRow[] };
}

function getLocationFromCoords(lat: number, lon: number): Promise<LocationParams> {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'Digit-Properties-Web/1.0' } }
  )
    .then((r) => r.json())
    .then((data: { address?: { suburb?: string; neighbourhood?: string; city?: string; town?: string; state?: string; county?: string } }) => {
      const a = data?.address;
      if (!a) return null;
      const suburb = a.suburb ?? a.neighbourhood ?? '';
      const city = a.city ?? a.town ?? a.county ?? '';
      const state = a.state ?? '';
      if (!suburb && !city && !state) return null;
      return { suburb: suburb || undefined, city: city || undefined, state: state || undefined };
    })
    .catch(() => null);
}

export function TrendingListings() {
  const [location, setLocation] = useState<LocationParams>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        getLocationFromCoords(pos.coords.latitude, pos.coords.longitude).then(setLocation);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }, []);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['listings', 'trending', location?.suburb ?? '', location?.city ?? '', location?.state ?? ''],
    queryFn: ({ pageParam }) => fetchTrending(location, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const lastLen = lastPage.listings?.length ?? 0;
      const loaded = allPages.reduce((n, p) => n + (p.listings?.length ?? 0), 0);
      const prevLoaded = loaded - lastLen;
      const requested =
        prevLoaded === 0 ? TRENDING_FIRST_PAGE : Math.min(TRENDING_FIRST_PAGE, TRENDING_MAX - prevLoaded);
      if (lastLen < requested) return undefined;
      if (loaded >= TRENDING_MAX) return undefined;
      return loaded;
    },
    staleTime: 60 * 1000,
  });

  const listings: ListingRow[] = useMemo(
    () => data?.pages.flatMap((p) => p.listings ?? []) ?? [],
    [data?.pages]
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, listings.length]);

  if (isLoading) {
    return (
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
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

  if (isError) {
    return (
      <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 py-16 text-center">
        <p className="text-red-600">Failed to load trending: {(error as Error)?.message}</p>
      </div>
    );
  }

  return (
    <>
      {location && (location.city || location.state) && (
        <p className="mt-2 text-sm text-gray-500">
          Trending near you: {[location.suburb, location.city, location.state].filter(Boolean).join(', ')}
        </p>
      )}
      <ListingGrid listings={listings} />
      {hasNextPage && (
        <div ref={loadMoreRef} className="h-4 w-full" aria-hidden />
      )}
      {isFetchingNextPage && (
        <p className="mt-4 text-center text-sm text-gray-500">Loading more…</p>
      )}
      {listings.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <p className="text-gray-500">No trending listings right now.</p>
        </div>
      )}
    </>
  );
}
