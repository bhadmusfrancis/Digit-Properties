'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface Listing {
  _id: string;
  title: string;
  price: number;
  listingType: string;
  rentPeriod?: 'day' | 'month' | 'year';
  propertyType: string;
  location: { city: string; state: string };
  bedrooms: number;
  bathrooms: number;
  images?: { url: string }[];
  isBoosted?: boolean;
  createdBy?: { name?: string; role?: string };
}

export function ListingGrid({ listings }: { listings: Listing[] }) {
  if (!listings?.length) return null;

  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {listings.map((listing) => (
        <Link
          key={listing._id}
          href={`/listings/${listing._id}`}
          className="card group transition hover:shadow-md"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
            {listing.images?.[0]?.url ? (
              <Image
                src={listing.images[0].url}
                alt={listing.title}
                fill
                className="object-cover transition group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">
                <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
            )}
            {listing.isBoosted && (
              <span className="absolute left-2 top-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                Sponsored
              </span>
            )}
            <span className="absolute right-2 top-2 rounded bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-800 capitalize">
              {listing.listingType}
              {listing.listingType === 'rent' && listing.rentPeriod && (
                <span className="ml-1 text-primary-600">• Per {listing.rentPeriod}</span>
              )}
            </span>
          </div>
          <div className="p-4">
            <p className="text-lg font-semibold text-gray-900 line-clamp-2">{listing.title}</p>
            <p className="mt-1 text-primary-600 font-bold">
              {formatPrice(listing.price, listing.listingType === 'rent' ? listing.rentPeriod : undefined)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {listing.location?.city}, {listing.location?.state}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">{listing.bedrooms} beds</span>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-600">{listing.bathrooms} baths</span>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-600 capitalize">{listing.propertyType}</span>
            </div>
            {listing.createdBy?.role && listing.createdBy.role !== 'guest' && (
              <div className="mt-2">
                <Badge role={listing.createdBy.role} />
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
