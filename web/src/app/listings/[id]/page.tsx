import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ListingDetailClient } from '@/components/listings/ListingDetailClient';
import { ListingImageGallery } from '@/components/listings/ListingImageGallery';
import { SimilarListingsInfinite } from '@/components/listings/SimilarListingsInfinite';
import { SocialShareButtons } from '@/components/ui/SocialShareButtons';
import { dbConnect } from '@/lib/db';
import { LISTING_STATUS, formatListingTypeLabel, formatPropertyTypeLabel, POPULAR_AMENITIES } from '@/lib/constants';
import { getDefaultListingImageUrl, getListingDisplayImage } from '@/lib/listing-default-image';
import { extractAmenitiesFromText, mergeUniqueLists } from '@/lib/listing-amenities';
import Listing from '@/models/Listing';
import ListingLike from '@/models/ListingLike';
import User from '@/models/User';
import mongoose from 'mongoose';
import type { Metadata } from 'next';

function serializeCreatedBy(createdBy: unknown): { _id: string; firstName?: string; name?: string; role?: string } | null {
  if (!createdBy || typeof createdBy !== 'object') return null;
  const obj = createdBy as { _id?: unknown; firstName?: string; name?: string; role?: string };
  const id = obj._id != null ? String(obj._id) : null;
  if (!id) return null;
  return { _id: id, firstName: obj.firstName, name: obj.name, role: obj.role };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return {};
    await dbConnect();
    const listing = await Listing.findById(id).lean();
    if (!listing) return {};
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
    const ogImage = getListingDisplayImage(
      listing.images as { url: string }[] | undefined,
      listing.propertyType ?? 'apartment',
      listing.videos as { url: string; public_id?: string }[] | undefined
    );
    const ogImageUrl = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;
    const description = listing.description?.slice(0, 160) ?? listing.title;
    return {
      title: listing.title,
      description,
      openGraph: {
        type: 'website',
        title: listing.title,
        description,
        url: `${baseUrl}/listings/${id}`,
        siteName: 'Digit Properties',
        locale: 'en_NG',
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: listing.title }],
      },
      twitter: {
        card: 'summary_large_image',
        title: listing.title,
        description,
        images: [ogImageUrl],
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
      Listing.findById(id).populate('createdBy', 'firstName name image role').lean(),
      ListingLike.countDocuments({ listingId: new mongoose.Types.ObjectId(id) }),
    ]);
    if (!listing) notFound();

    const currentCity = listing.location?.city ?? '';
    const currentState = listing.location?.state ?? '';
    const listingIdOid = new mongoose.Types.ObjectId(id);
    const similarAgg = await Listing.aggregate([
      {
        $match: {
          _id: { $ne: listingIdOid },
          status: LISTING_STATUS.ACTIVE,
          propertyType: listing.propertyType ?? '',
        },
      },
      {
        $addFields: {
          hasMediaScore: {
            $cond: {
              if: {
                $or: [
                  {
                    $and: [
                      { $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] },
                      { $ne: [{ $ifNull: ['$images.0.url', ''] }, ''] },
                    ],
                  },
                  {
                    $and: [
                      { $gt: [{ $size: { $ifNull: ['$videos', []] } }, 0] },
                      { $ne: [{ $ifNull: ['$videos.0.url', ''] }, ''] },
                    ],
                  },
                ],
              },
              then: 1,
              else: 0,
            },
          },
          proximityScore: {
            $cond: {
              if: {
                $and: [
                  { $eq: ['$location.city', currentCity] },
                  { $eq: ['$location.state', currentState] },
                ],
              },
              then: 2,
              else: {
                $cond: {
                  if: { $eq: ['$location.state', currentState] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
      },
      { $sort: { hasMediaScore: -1, proximityScore: -1, createdAt: -1 } },
      { $limit: 12 },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdByDoc',
        },
      },
    ]).exec();
    const similarListings = similarAgg.map((doc: Record<string, unknown>) => {
      const createdByDoc = Array.isArray(doc.createdByDoc) ? doc.createdByDoc[0] : null;
      const cb = createdByDoc && typeof createdByDoc === 'object' ? createdByDoc as { _id?: unknown; firstName?: string; name?: string; role?: string } : null;
      const loc = doc.location as Record<string, unknown> | undefined;
      const location = loc && typeof loc === 'object'
        ? {
            address: typeof loc.address === 'string' ? loc.address : '',
            city: typeof loc.city === 'string' ? loc.city : '',
            state: typeof loc.state === 'string' ? loc.state : '',
            suburb: typeof loc.suburb === 'string' ? loc.suburb : undefined,
          }
        : { address: '', city: '', state: '' };
      const rawImages = Array.isArray(doc.images) ? doc.images : [];
      const images = rawImages.map((img: unknown) => {
        const o = img && typeof img === 'object' && img !== null ? img as Record<string, unknown> : {};
        return {
          url: typeof o.url === 'string' ? o.url : '',
          public_id: o.public_id != null ? String(o.public_id) : undefined,
        };
      });
      const rawVideos = Array.isArray(doc.videos) ? doc.videos : [];
      const videos = rawVideos.map((v: unknown) => {
        const o = v && typeof v === 'object' && v !== null ? v as Record<string, unknown> : {};
        return {
          url: typeof o.url === 'string' ? o.url : '',
          public_id: o.public_id != null ? String(o.public_id) : undefined,
        };
      });
      return {
        _id: String(doc._id),
        title: typeof doc.title === 'string' ? doc.title : '',
        price: typeof doc.price === 'number' ? doc.price : 0,
        listingType: typeof doc.listingType === 'string' ? doc.listingType : 'sale',
        rentPeriod:
          typeof doc.rentPeriod === 'string' && ['day', 'month', 'year'].includes(doc.rentPeriod)
            ? (doc.rentPeriod as 'day' | 'month' | 'year')
            : undefined,
        propertyType: typeof doc.propertyType === 'string' ? doc.propertyType : 'apartment',
        location,
        bedrooms: typeof doc.bedrooms === 'number' ? doc.bedrooms : 0,
        bathrooms: typeof doc.bathrooms === 'number' ? doc.bathrooms : 0,
        toilets: typeof doc.toilets === 'number' ? doc.toilets : undefined,
        images,
        videos,
        isBoosted: doc.boostExpiresAt ? new Date(doc.boostExpiresAt as Date) > new Date() : false,
        createdBy: cb
          ? { _id: cb._id != null ? String(cb._id) : undefined, firstName: cb.firstName, name: cb.name, role: cb.role }
          : undefined,
      };
    });

    const createdById = listing.createdBy && typeof listing.createdBy === 'object' && '_id' in listing.createdBy
      ? String((listing.createdBy as { _id: unknown })._id)
      : String(listing.createdBy);
    const isOwner = !!session?.user?.id && createdById === session.user.id;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
    const isBoosted = listing.boostExpiresAt && new Date(listing.boostExpiresAt) > new Date();
    const derivedAmenities = mergeUniqueLists(
      listing.amenities,
      extractAmenitiesFromText(
        `${listing.title ?? ''}\n${listing.description ?? ''}\n${(listing.tags ?? []).join(', ')}`,
        POPULAR_AMENITIES
      )
    );
    const rawImageItems = Array.isArray(listing.images) ? listing.images : [];
    const rawVideoItems = Array.isArray(listing.videos) ? listing.videos : [];
    const images = rawImageItems
      .map((img) => ({
        url: typeof img?.url === 'string' ? img.url : '',
        public_id: img?.public_id != null ? String(img.public_id) : undefined,
        type: 'image' as const,
      }))
      .filter((img) => img.url);
    const videos = rawVideoItems
      .map((v) => ({
        url: typeof v?.url === 'string' ? v.url : '',
        public_id: v?.public_id != null ? String(v.public_id) : undefined,
        type: 'video' as const,
      }))
      .filter((v) => v.url);
    const galleryMedia = images.length + videos.length > 0
      ? [...images, ...videos]
      : [{ url: getDefaultListingImageUrl(listing.propertyType ?? 'apartment'), public_id: 'default-media', type: 'image' as const }];

    return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <ListingImageGallery images={galleryMedia} title={listing.title} isBoosted={isBoosted} />
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
                <span>{formatPropertyTypeLabel(String(listing.propertyType ?? ''))}</span>
                <span>{formatListingTypeLabel(String(listing.listingType ?? ''))}</span>
              </div>
              <div className="mt-4 text-gray-700 prose prose-slate max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0">
                {listing.description && /<[a-z][\s\S]*>/i.test(listing.description) ? (
                  <div dangerouslySetInnerHTML={{ __html: listing.description }} />
                ) : (
                  <p>{listing.description}</p>
                )}
              </div>
              {derivedAmenities.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900">Amenities</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {derivedAmenities.map((a) => (
                      <Link
                        key={a}
                        href={`/listings?tags=${encodeURIComponent(a)}`}
                        className="rounded-full bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
                        aria-label={`Show listings with amenity ${a}`}
                      >
                        {a}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <SocialShareButtons
                  url={`${baseUrl}/listings/${id}`}
                  title={listing.title}
                  text={listing.description?.slice(0, 100)}
                />
              </div>
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
                  My Properties
                </Link>
              </div>
            )}
            <Link href="/listings" className="btn-secondary mt-4 block text-center">
              Back to listings
            </Link>
          </div>
        </div>
      </div>

      {similarListings.length > 0 && (
        <SimilarListingsInfinite listingId={id} initialListings={similarListings} />
      )}
    </div>
    );
  } catch (e) {
    console.error('[ListingPage]', e);
    notFound();
  }
}
