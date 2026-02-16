'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

export default function SavedListingsPage() {
  const { data: listings, isLoading } = useQuery({
    queryKey: ['saved'],
    queryFn: () => fetch('/api/saved').then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Saved Listings</h1>
        <div className="mt-6 h-48 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  const list = Array.isArray(listings) ? listings : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Saved Listings</h1>
      <p className="mt-1 text-gray-600">Properties you have saved.</p>
      <div className="mt-6 space-y-4">
        {list.map((l: { _id: string; title: string; price: number; listingType?: string; rentPeriod?: 'day'|'month'|'year'; location?: { city: string; state: string } }) => (
          <Link
            key={l._id}
            href={`/listings/${l._id}`}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50"
          >
            <span className="font-medium">{l.title}</span>
            <span className="text-primary-600 font-semibold">{formatPrice(l.price, l.listingType === 'rent' ? l.rentPeriod : undefined)}</span>
          </Link>
        ))}
        {list.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center text-gray-500">
            No saved listings. Browse and save properties you like.
          </div>
        )}
      </div>
    </div>
  );
}
