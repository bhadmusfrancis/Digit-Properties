import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ListingDetailClient } from '@/components/listings/ListingDetailClient';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import ListingLike from '@/models/ListingLike';
import User from '@/models/User';
import mongoose from 'mongoose';
import type { Metadata } from 'next';

function serializeCreatedBy(createdBy: unknown): { _id: string; name?: string; role?: string } | null {
  if (!createdBy || typeof createdBy !== 'object') return null;
  const obj = createdBy as { _id?: unknown; name?: string; role?: string };
  const id = obj._id != null ? String(obj._id) : null;
  if (!id) return null;
  return { _id: id, name: obj.name, role: obj.role };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return {};
    await dbConnect();
    const listing = await Listing.findById(id).lean();
    if (!listing) return {};
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
    return {
      title: listing.title,
      description: listing.description?.slice(0, 160),
      openGraph: {
        title: listing.title,
        description: listing.description?.slice(0, 160),
        url: `${baseUrl}/listings/${id}`,
        images: listing.images?.[0]?.url ? [{ url: listing.images[0].url }] : undefined,
      },
    };
  } catch (e) {
    console.error('[ListingPage generateMetadata]', e);
    return {};
  }
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) notFound();

    await dbConnect();
    void User; // Ensure User model is registered for populate
    const [session, listing, likeCount] = await Promise.all([
      getServerSession(authOptions),
      Listing.findById(id).populate('createdBy', 'name image role').lean(),
      ListingLike.countDocuments({ listingId: new mongoose.Types.ObjectId(id) }),
    ]);
    if (!listing) notFound();

    const createdById = listing.createdBy && typeof listing.createdBy === 'object' && '_id' in listing.createdBy
      ? String((listing.createdBy as { _id: unknown })._id)
      : String(listing.createdBy);
    const isOwner = !!session?.user?.id && createdById === session.user.id;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
    const isBoosted = listing.boostExpiresAt && new Date(listing.boostExpiresAt) > new Date();

    return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="relative aspect-video bg-gray-200">
              {listing.images?.[0]?.url ? (
                <Image
                  src={listing.images[0].url}
                  alt={listing.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 66vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">
                  <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
              )}
              {isBoosted && (
                <span className="absolute left-4 top-4 rounded bg-amber-500 px-3 py-1 text-sm font-medium text-white">
                  Sponsored
                </span>
              )}
            </div>
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">{listing.title}</h1>
              <p className="mt-2 text-2xl font-bold text-primary-600">
                {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(listing.price)}
                {listing.listingType === 'rent' && listing.rentPeriod && (
                  <span className="ml-2 text-base font-normal text-gray-600">
                    / {listing.rentPeriod === 'day' ? 'day' : listing.rentPeriod === 'month' ? 'month' : 'year'}
                  </span>
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                <span>{listing.bedrooms} beds</span>
                <span>{listing.bathrooms} baths</span>
                {listing.toilets != null && listing.toilets > 0 && <span>{listing.toilets} toilets</span>}
                {listing.area && <span>{listing.area} sqm</span>}
                <span className="capitalize">{listing.propertyType}</span>
                <span className="capitalize">{listing.listingType}</span>
              </div>
              <p className="mt-4 text-gray-700">{listing.description}</p>
              {listing.amenities?.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900">Amenities</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {listing.amenities.map((a) => (
                      <span key={a} className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900">Location</h3>
            <p className="mt-2 text-gray-600">
              {listing.location?.address}
              <br />
              {[listing.location?.suburb, listing.location?.city, listing.location?.state].filter(Boolean).join(', ')}
            </p>
            <ListingDetailClient
              listingId={String(listing._id)}
              title={listing.title}
              createdBy={serializeCreatedBy(listing.createdBy)}
              createdByType={listing.createdByType ?? 'user'}
              baseUrl={baseUrl}
              isOwner={isOwner}
              viewCount={listing.viewCount ?? 0}
              likeCount={likeCount}
            />
            {isOwner && (
              <div className="mt-4 flex gap-3">
                <Link href={`/listings/${listing._id}/edit`} className="btn-primary flex-1 text-center">
                  Edit listing
                </Link>
                <Link href="/dashboard/listings" className="btn-secondary flex-1 text-center">
                  My listings
                </Link>
              </div>
            )}
            <Link href="/listings" className="btn-secondary mt-4 block text-center">
              Back to listings
            </Link>
          </div>
        </div>
      </div>
    </div>
    );
  } catch (e) {
    console.error('[ListingPage]', e);
    notFound();
  }
}
