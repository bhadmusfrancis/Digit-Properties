'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';
import { getListingDisplayImage } from '@/lib/listing-default-image';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';

interface Listing {
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
  createdBy?: { _id?: string; name?: string; role?: string };
}

export function ListingGrid({ listings }: { listings: Listing[] }) {
  if (!listings?.length) return null;

  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {listings.map((listing) => (
        <article key={listing._id} className="card group transition hover:shadow-md">
          <Link href={`/listings/${listing._id}`} className="block">
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
              <Image
                src={getListingDisplayImage(listing.images, listing.propertyType)}
                alt={listing.title}
                fill
                className="object-cover transition group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
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
                {listing.toilets != null && listing.toilets > 0 && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-600">{listing.toilets} toilets</span>
                  </>
                )}
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-600 capitalize">{listing.propertyType}</span>
              </div>
            </div>
          </Link>
          {(listing.createdBy?.role || listing.createdBy?._id) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 px-4 pb-4">
              {listing.createdBy.role && listing.createdBy.role !== 'guest' && (
                <VerifiedBadge role={listing.createdBy.role} />
              )}
              {listing.createdBy._id && (
                <Link
                  href={`/authors/${listing.createdBy._id}`}
                  className="text-sm text-gray-500 hover:text-primary-600"
                >
                  By {listing.createdBy.name ?? 'Author'}
                </Link>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
