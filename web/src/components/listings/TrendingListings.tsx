'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ListingGrid } from './ListingGrid';

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
  isBoosted?: boolean;
  createdBy?: { name?: string; role?: string };
};

async function fetchTrending(location: LocationParams) {
  const params = new URLSearchParams({ limit: '20' });
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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['listings', 'trending', location?.suburb ?? '', location?.city ?? '', location?.state ?? ''],
    queryFn: () => fetchTrending(location),
    staleTime: 60 * 1000,
  });

  const listings: ListingRow[] = data?.listings ?? [];

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
      {listings.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <p className="text-gray-500">No trending listings right now.</p>
        </div>
      )}
    </>
  );
}
