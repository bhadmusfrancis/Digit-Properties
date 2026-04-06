import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canViewListingOnSite } from '@/lib/listing-access';
import { ListingDetailClient } from '@/components/listings/ListingDetailClient';
import { ListingImageGallery } from '@/components/listings/ListingImageGallery';
import { SimilarListingsInfinite } from '@/components/listings/SimilarListingsInfinite';
import { ListingTitleWithVerifiedBadge } from '@/components/listings/ListingTitleWithVerifiedBadge';
import { SocialShareButtons } from '@/components/ui/SocialShareButtons';
import { dbConnect } from '@/lib/db';
import { LISTING_STATUS, formatListingTypeLabel, formatPropertyTypesLine, POPULAR_AMENITIES } from '@/lib/constants';
import { getCloudinaryVideoThumbnailUrl, getDefaultListingImageUrl } from '@/lib/listing-default-image';
import { extractAmenitiesFromText, mergeUniqueLists } from '@/lib/listing-amenities';
import { formatListingLocationDisplay } from '@/lib/listing-location';
import Listing from '@/models/Listing';
import ListingLike from '@/models/ListingLike';
import User from '@/models/User';
import mongoose from 'mongoose';
import type { Metadata } from 'next';
import { buildListingShareDescription, listingDocToShareFields } from '@/lib/listing-share-text';
import { shapePublicCreatedBy, USER_PUBLIC_BADGE_FIELDS } from '@/lib/verification';
import { siteOrigin } from '@/lib/site-metadata';

function isVideoUrl(url: string): boolean {
  const clean = (url || '').split('?')[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v|ogg|ogv)$/.test(clean) || clean.includes('/video/upload/');
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return {};
    await dbConnect();
    const [session, listing] = await Promise.all([
      getServerSession(authOptions),
      Listing.findById(id).lean(),
    ]);
    if (!listing) return {};
    if (
      !canViewListingOnSite({
        status: listing.status,
        createdBy: listing.createdBy,
        session,
      })
    ) {
      notFound();
    }
    const baseUrl = siteOrigin();
    const canonical = `${baseUrl}/listings/${id}`;
    const shareFields = listingDocToShareFields({
      ...listing,
      propertyTypes: (listing as { propertyTypes?: string[] }).propertyTypes,
    });
    const description = buildListingShareDescription(shareFields, { maxLen: 160 });
    const createdAt = listing.createdAt ? new Date(listing.createdAt as Date) : undefined;
    const updatedAt = listing.updatedAt ? new Date(listing.updatedAt as Date) : undefined;
    return {
      title: listing.title,
      description,
      alternates: { canonical },
      openGraph: {
        type: 'article',
        title: listing.title,
        description,
        url: canonical,
        siteName: 'Digit Properties',
        locale: 'en_NG',
        publishedTime: createdAt?.toISOString(),
        modifiedTime: updatedAt?.toISOString(),
      },
      twitter: {
        card: 'summary_large_image',
        title: listing.title,
        description,
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
      Listing.findById(id).populate('createdBy', USER_PUBLIC_BADGE_FIELDS).lean(),
      ListingLike.countDocuments({ listingId: new mongoose.Types.ObjectId(id) }),
    ]);
    if (!listing) notFound();

    if (
      !canViewListingOnSite({
        status: listing.status,
        createdBy: listing.createdBy,
        session,
      })
    ) {
      notFound();
    }

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
          pipeline: [
            {
              $project: {
                firstName: 1,
                name: 1,
                image: 1,
                role: 1,
                verifiedAt: 1,
                phoneVerifiedAt: 1,
                identityVerifiedAt: 1,
                livenessVerifiedAt: 1,
              },
            },
          ],
        },
      },
    ]).exec();
    const similarListings = similarAgg.map((doc: Record<string, unknown>) => {
      const createdByDoc = Array.isArray(doc.createdByDoc) ? doc.createdByDoc[0] : null;
      const cb = createdByDoc && typeof createdByDoc === 'object' ? createdByDoc : null;
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
        soldAt: doc.soldAt ? new Date(doc.soldAt as Date).toISOString() : undefined,
        rentedAt: doc.rentedAt ? new Date(doc.rentedAt as Date).toISOString() : undefined,
        createdBy: cb ? shapePublicCreatedBy(cb) ?? undefined : undefined,
      };
    });

    const createdById = listing.createdBy && typeof listing.createdBy === 'object' && '_id' in listing.createdBy
      ? String((listing.createdBy as { _id: unknown })._id)
      : String(listing.createdBy);
    const isOwner = !!session?.user?.id && createdById === session.user.id;

    const baseUrl = siteOrigin();
    const shareFields = listingDocToShareFields({
      ...listing,
      propertyTypes: (listing as { propertyTypes?: string[] }).propertyTypes,
    });
    const shareDescription = buildListingShareDescription(shareFields, { maxLen: 480 });
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
      .filter((img) => img.url && !isVideoUrl(img.url));
    const videos = rawVideoItems
      .map((v) => ({
        url: typeof v?.url === 'string' ? v.url : '',
        public_id: v?.public_id != null ? String(v.public_id) : undefined,
        type: 'video' as const,
      }))
      .filter((v) => v.url);
    // Backward compatibility: older imports may have video URLs saved inside images.
    const videosFromImages = rawImageItems
      .map((img) => ({
        url: typeof img?.url === 'string' ? img.url : '',
        public_id: img?.public_id != null ? String(img.public_id) : undefined,
        type: 'video' as const,
      }))
      .filter((v) => v.url && isVideoUrl(v.url));

    const hasGalleryStills = images.length > 0;
    const hasGalleryVideos = videos.length + videosFromImages.length > 0;
    const hasAnyGalleryMedia = hasGalleryStills || hasGalleryVideos;

    let galleryMedia: Array<{ url: string; public_id?: string; type: 'image' | 'video' }>;
    if (!hasAnyGalleryMedia) {
      galleryMedia = [
        {
          url: getDefaultListingImageUrl(listing.propertyType ?? 'apartment'),
          public_id: 'default-media',
          type: 'image',
        },
      ];
    } else if (!hasGalleryStills && hasGalleryVideos) {
      const firstVideo = videos[0] ?? videosFromImages[0];
      const posterUrl = firstVideo ? getCloudinaryVideoThumbnailUrl(firstVideo) : null;
      const posterSlide = posterUrl
        ? [
            {
              url: posterUrl,
              public_id: firstVideo.public_id ? `${firstVideo.public_id}_poster` : 'video-poster',
              type: 'image' as const,
            },
          ]
        : [];
      galleryMedia = [...posterSlide, ...videos, ...videosFromImages];
    } else {
      galleryMedia = [...images, ...videos, ...videosFromImages];
    }

    return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <ListingImageGallery images={galleryMedia} title={listing.title} isBoosted={isBoosted} />
            <div className="p-6">
              <ListingTitleWithVerifiedBadge title={listing.title} createdBy={shapePublicCreatedBy(listing.createdBy)} />
              {(listing.soldAt || listing.rentedAt) && (
                <div className="mt-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      listing.soldAt ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {listing.soldAt ? 'Sold' : 'Rented'}
                  </span>
                </div>
              )}
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
                <span>
                  {formatPropertyTypesLine(
                    (listing as { propertyTypes?: string[] }).propertyTypes,
                    String(listing.propertyType ?? '')
                  )}
                </span>
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
                  text={shareDescription}
                />
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900">Location</h3>
            <p className="mt-2 text-gray-600">
              {formatListingLocationDisplay(listing.location)}
            </p>
            <ListingDetailClient
              listingId={String(listing._id)}
              title={listing.title}
              createdBy={shapePublicCreatedBy(listing.createdBy)}
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
