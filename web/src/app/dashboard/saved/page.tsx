'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';

type FavoriteListing = {
  _id: string;
  title: string;
  price: number;
  listingType?: string;
  rentPeriod?: 'day' | 'month' | 'year';
  location?: { city: string; state: string };
  images?: { public_id: string; url: string }[];
};

export default function SavedListingsPage() {
  const { data: listings, isLoading } = useQuery({
    queryKey: ['saved'],
    queryFn: () => fetch('/api/saved').then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Favorites</h1>
        <div className="mt-6 h-48 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  const list = Array.isArray(listings) ? (listings as FavoriteListing[]) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Favorites</h1>
      <p className="mt-1 text-gray-600">Properties you have added to your favorites.</p>
      <div className="mt-6 space-y-4">
        {list.map((l) => {
          const thumbUrl = l.images?.[0]?.url;
          return (
            <Link
              key={l._id}
              href={`/listings/${l._id}`}
              className="flex gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50"
            >
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-gray-100">
                {thumbUrl ? (
                  <Image
                    src={thumbUrl}
                    alt=""
                    width={112}
                    height={80}
                    className="h-full w-full object-cover"
                    unoptimized={thumbUrl.includes('cloudinary') ? false : true}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-medium text-gray-900 truncate">{l.title}</span>
                {l.location?.city && (
                  <span className="mt-0.5 block text-sm text-gray-500 truncate">
                    {[l.location.city, l.location.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-primary-600 font-semibold">
                {formatPrice(l.price, l.listingType === 'rent' ? l.rentPeriod : undefined)}
              </span>
            </Link>
          );
        })}
        {list.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center text-gray-500">
            No favorites yet. Browse listings and add properties you like to your favorites.
          </div>
        )}
      </div>
    </div>
  );
}
