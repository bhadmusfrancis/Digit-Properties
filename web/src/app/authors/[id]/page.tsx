import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import mongoose from 'mongoose';
import type { Metadata } from 'next';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import Listing from '@/models/Listing';
import { LISTING_STATUS } from '@/lib/constants';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { AuthorLikeButton } from '@/components/authors/AuthorLikeButton';
import { getListingDisplayImage } from '@/lib/listing-default-image';
import {
  LISTING_TRUST_CAVEAT_TEXT,
  shouldShowListingTrustCaveat,
} from '@/lib/listing-trust-caveat';
import { formatPrice } from '@/lib/utils';
import { formatListingTypeLabel, formatPropertyTypeLabel } from '@/lib/constants';

const PUBLIC_USER_SELECT = 'name image role companyPosition';
const LISTING_SELECT = 'title price listingType rentPeriod propertyType location bedrooms bathrooms toilets images';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return {};
    await dbConnect();
    const user = await User.findById(id).select('name role').lean();
    if (!user) return {};
    const name = (user as { name?: string }).name ?? 'Author';
    const role = (user as { role?: string }).role;
    const title = role ? `${name} · ${role.replace(/_/g, ' ')}` : name;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
    return {
      title: `${title} | Digit Properties`,
      description: `View ${name}'s property listings on Digit Properties.`,
      openGraph: {
        type: 'profile',
        title: `${name} | Digit Properties`,
        url: `${baseUrl}/authors/${id}`,
        siteName: 'Digit Properties',
        locale: 'en_NG',
      },
    };
  } catch {
    return {};
  }
}

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await dbConnect();
  const [user, listings] = await Promise.all([
    User.findById(id).select(PUBLIC_USER_SELECT).lean(),
    Listing.find({ createdBy: new mongoose.Types.ObjectId(id), status: LISTING_STATUS.ACTIVE })
      .sort({ createdAt: -1 })
      .limit(24)
      .select(LISTING_SELECT)
      .lean(),
  ]);

  if (!user) notFound();

  const name = (user as { name?: string }).name ?? 'Author';
  const image = (user as { image?: string }).image;
  const role = (user as { role?: string }).role;
  const showTrustCaveat = shouldShowListingTrustCaveat({ role });
  const companyPosition = (user as { companyPosition?: string }).companyPosition;
  const totalListings = listings.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Author header */}
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-2 ring-primary-100">
            {image && image.startsWith('http') ? (
              <Image
                src={image}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary-100 text-2xl font-semibold text-primary-700">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {role && role !== 'guest' && <VerifiedBadge role={role} showCaveat />}
              {companyPosition && (
                <span className="text-sm text-gray-600">{companyPosition}</span>
              )}
            </div>
            <p className="mt-3 text-gray-600">
              {totalListings === 0
                ? 'No active listings yet.'
                : totalListings === 1
                  ? '1 active listing'
                  : `${totalListings} active listings`}
            </p>
            {showTrustCaveat && (
              <p className="mt-2 text-xs text-amber-700">{LISTING_TRUST_CAVEAT_TEXT}</p>
            )}
            <AuthorLikeButton authorId={id} />
          </div>
        </div>
      </header>

      {/* Listings */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">
          {totalListings === 0 ? 'Listings' : 'Listings by this author'}
        </h2>
        {totalListings === 0 ? (
          <div className="mt-6 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-12 text-center">
            <p className="text-gray-500">This author has no active listings at the moment.</p>
            <Link href="/listings" className="mt-4 inline-block text-primary-600 hover:underline">
              Browse all listings →
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => {
              const l = listing as {
                _id: unknown;
                title: string;
                price: number;
                listingType: string;
                rentPeriod?: string;
                propertyType: string;
                location?: { city?: string; state?: string };
                bedrooms: number;
                bathrooms: number;
                toilets?: number;
                images?: { url: string }[];
                videos?: { url: string; public_id?: string }[];
              };
              const listingId = String(l._id);
              return (
                <Link
                  key={listingId}
                  href={`/listings/${listingId}`}
                  className="card group overflow-hidden transition hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
                    <Image
                      src={getListingDisplayImage(l.images, l.propertyType, l.videos)}
                      alt={l.title}
                      fill
                      className="object-cover transition group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <span className="absolute right-2 top-2 rounded bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-800">
                      {formatListingTypeLabel(l.listingType)}
                      {l.listingType === 'rent' && l.rentPeriod && (
                        <span className="ml-1 text-primary-600">· Per {l.rentPeriod}</span>
                      )}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-900 line-clamp-2">{l.title}</p>
                    <p className="mt-1 text-primary-600 font-bold">
                      {formatPrice(l.price, l.listingType === 'rent' ? l.rentPeriod : undefined)}
                    </p>
                    {l.location && (
                      <p className="mt-1 text-sm text-gray-500">
                        {l.location.city}, {l.location.state}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-600">
                      <span>{l.bedrooms} beds</span>
                      <span className="text-gray-400">·</span>
                      <span>{l.bathrooms} baths</span>
                      {l.toilets != null && l.toilets > 0 && (
                        <>
                          <span className="text-gray-400">·</span>
                          <span>{l.toilets} toilets</span>
                        </>
                      )}
                      <span className="text-gray-400">·</span>
                      <span>{formatPropertyTypeLabel(l.propertyType)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-10 border-t border-gray-200 pt-6">
        <Link href="/listings" className="text-primary-600 hover:underline">
          ← Back to all listings
        </Link>
      </div>
    </div>
  );
}
