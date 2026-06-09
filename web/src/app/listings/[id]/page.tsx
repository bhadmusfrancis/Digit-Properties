import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { canViewListingOnSite, isListingPendingApprovalHidden } from '@/lib/listing-access';
import { ListingLocationMap } from '@/components/listings/ListingLocationMap';
import { ListingSidebarTabs } from '@/components/listings/ListingSidebarTabs';
import { ListingImageGallery } from '@/components/listings/ListingImageGallery';
import { ListingMarketStatusSticker } from '@/components/listings/ListingMarketStatusSticker';
import { SimilarListingsInfinite } from '@/components/listings/SimilarListingsInfinite';
import { FeaturedSlot } from '@/components/listings/FeaturedSlot';
import { ListingTitleWithVerifiedBadge } from '@/components/listings/ListingTitleWithVerifiedBadge';
import { ListingTrustCaveat } from '@/components/listings/ListingTrustCaveat';
import { ListingOwnerStatusBanner } from '@/components/listings/ListingOwnerStatusBanner';
import { ListingTemporarilyUnavailable } from '@/components/listings/ListingTemporarilyUnavailable';
import { ListingIndexabilityBanner } from '@/components/listings/ListingIndexabilityBanner';
import { SocialShareButtons } from '@/components/ui/SocialShareButtons';
import { dbConnect } from '@/lib/db';
import { LISTING_STATUS, USER_ROLES, formatListingTypeLabel, formatPropertyTypesLine, POPULAR_AMENITIES } from '@/lib/constants';
import {
  getDefaultListingImageUrl,
  getListingDisplayImage,
  getListingImagesForDisplay,
  getListingOpenGraphImages,
  isVideoUrl,
} from '@/lib/listing-default-image';
import { extractAmenitiesFromText, mergeUniqueLists } from '@/lib/listing-amenities';
import { formatListingLocationDisplay } from '@/lib/listing-location';
import Listing from '@/models/Listing';
import ListingLike from '@/models/ListingLike';
import User from '@/models/User';
import mongoose from 'mongoose';
import type { Metadata } from 'next';
import { buildListingShareDescription, listingDocToShareFields } from '@/lib/listing-share-text';
import { isBotListingAuthor } from '@/lib/claimable-listing';
import { getBotUserObjectIds } from '@/lib/claimable-listing-server';
import { shapePublicCreatedBy, USER_PUBLIC_BADGE_FIELDS } from '@/lib/verification';
import { siteOrigin } from '@/lib/site-metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildBreadcrumbJsonLd, buildListingJsonLd } from '@/lib/seo/structured-data';
import {
  buildListingVideoSeoItems,
  collectListingGalleryVideos,
  normalizeVideoContentUrl,
} from '@/lib/seo/listing-videos';
import { plainTextExcerpt, isNextNavigationError } from '@/lib/utils';
import { getListingPublicPath } from '@/lib/listing-path';
import {
  buildLocationLandingPath,
  relatedLocationLinks,
} from '@/lib/location-seo';
import { resolveListingPublicSegment } from '@/lib/resolve-listing';
import { canNonAdminEditListing } from '@/lib/listing-edit-window';
import { isListingIndexable } from '@/lib/seo/listing-indexability';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    await dbConnect();
    const session = await getServerSession(authOptions);
    let resolved;
    try {
      resolved = await resolveListingPublicSegment(id);
    } catch {
      return {};
    }
    const { listing, publicSegment } = resolved;
    if (!listing || !publicSegment) return {};

    if (
      isListingPendingApprovalHidden({
        status: listing.status,
        createdBy: listing.createdBy,
        session,
      })
    ) {
      return {
        title: 'Temporarily unavailable',
        description: 'This property listing is being reviewed and is temporarily unavailable.',
        robots: { index: false, follow: true },
      };
    }
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
    const canonical = `${baseUrl}/listings/${publicSegment}`;
    const isLegacyObjectIdUrl = id.trim() !== publicSegment;
    // Thin, media-less listings fall back to a shared stock image + short text, which Google
    // clusters as duplicates and assigns a different canonical. Keep them crawlable (follow)
    // but out of the index until they have their own media or a substantial description.
    const isIndexable =
      !isLegacyObjectIdUrl &&
      isListingIndexable({
        images: (listing as { images?: { url?: string }[] }).images,
        videos: (listing as { videos?: { url?: string; public_id?: string }[] }).videos,
        description: listing.description,
      });
    const shareFields = listingDocToShareFields({
      ...listing,
      propertyTypes: (listing as { propertyTypes?: string[] }).propertyTypes,
    });
    const description = buildListingShareDescription(shareFields, { maxLen: 160 });
    const createdAt = listing.createdAt ? new Date(listing.createdAt as Date) : undefined;
    const updatedAt = listing.updatedAt ? new Date(listing.updatedAt as Date) : undefined;
    const ogImages = getListingOpenGraphImages(
      baseUrl,
      (listing as { images?: { url?: string }[] }).images,
      String((listing as { propertyType?: string }).propertyType ?? 'apartment'),
      (listing as { videos?: { url?: string; public_id?: string }[] }).videos,
      listing.title ?? 'Property listing'
    );
    const primaryOg = ogImages[0];
    const listingImages = (listing as { images?: { url?: string; public_id?: string }[] }).images;
    const listingVideos = (listing as { videos?: { url?: string; public_id?: string }[] }).videos;
    const metaGalleryVideos = collectListingGalleryVideos(listingImages, listingVideos);
    const metaVideoSeo =
      metaGalleryVideos.length > 0
        ? buildListingVideoSeoItems({
            title: String(listing.title ?? ''),
            description,
            pagePath: `/listings/${publicSegment}`,
            uploadDate: createdAt?.toISOString(),
            videos: metaGalleryVideos,
          })
        : [];
    return {
      title: listing.title,
      description,
      alternates: { canonical },
      robots: isIndexable
        ? { index: true, follow: true }
        : { index: false, follow: true },
      openGraph: {
        type: 'article',
        title: listing.title,
        description,
        url: canonical,
        siteName: 'Digit Properties',
        locale: 'en_NG',
        publishedTime: createdAt?.toISOString(),
        modifiedTime: updatedAt?.toISOString(),
        ...(ogImages.length > 0 ? { images: ogImages } : {}),
        ...(metaVideoSeo.length > 0
          ? {
              videos: metaVideoSeo.map((v) => ({
                url: v.contentUrl,
                width: 1280,
                height: 720,
                type: 'video/mp4',
              })),
            }
          : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title: listing.title,
        description,
        ...(primaryOg ? { images: [primaryOg.url] } : {}),
      },
    };
  } catch (e) {
    if (isNextNavigationError(e)) throw e;
    console.error('[ListingPage generateMetadata]', e);
    return {};
  }
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();
  void User; // Ensure User model is registered for populate
  const session = await getServerSession(authOptions);

  let resolved;
  try {
    resolved = await resolveListingPublicSegment(id);
  } catch {
    notFound();
  }
  const { listing: listingPre, publicSegment, shouldRedirect, redirectTo } = resolved;
  if (shouldRedirect && redirectTo) {
    permanentRedirect(redirectTo);
  }
  if (!listingPre || !publicSegment) notFound();

  if (
    isListingPendingApprovalHidden({
      status: listingPre.status,
      createdBy: listingPre.createdBy,
      session,
    })
  ) {
    return (
      <ListingTemporarilyUnavailable
        title={listingPre.title}
        state={listingPre.location?.state}
        city={listingPre.location?.city}
      />
    );
  }

  try {
    const listingId = String(listingPre._id);
    const listing = await Listing.findById(listingId).populate('createdBy', USER_PUBLIC_BADGE_FIELDS).lean();
    if (!listing) notFound();

    const [likeCount] = await Promise.all([
      ListingLike.countDocuments({ listingId: new mongoose.Types.ObjectId(listingId) }),
    ]);

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
    const listingIdOid = new mongoose.Types.ObjectId(listingId);
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
        slug: typeof doc.slug === 'string' ? doc.slug : undefined,
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
    const createdByOid = mongoose.Types.ObjectId.isValid(createdById)
      ? new mongoose.Types.ObjectId(createdById)
      : null;
    const botUserIds = await getBotUserObjectIds();
    const isOwner = !!session?.user?.id && createdById === session.user.id;
    const publicCreatedBy = shapePublicCreatedBy(listing.createdBy);
    const isBotListing =
      isBotListingAuthor({
        createdByType: listing.createdByType,
        createdBy: listing.createdBy,
        tags: listing.tags,
      }) ||
      (createdByOid != null && botUserIds.some((id) => id.equals(createdByOid)));
    const isAdmin = session?.user?.role === USER_ROLES.ADMIN;
    const canEditListing =
      isOwner &&
      (isAdmin ||
        canNonAdminEditListing({
          createdAt: listing.createdAt as Date,
          claimedAt: (listing as { claimedAt?: Date }).claimedAt,
        }));

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
        url: typeof v?.url === 'string' ? normalizeVideoContentUrl(v.url) : '',
        public_id: v?.public_id != null ? String(v.public_id) : undefined,
        type: 'video' as const,
      }))
      .filter((v) => v.url);
    // Backward compatibility: older imports may have video URLs saved inside images.
    const videosFromImages = rawImageItems
      .map((img) => ({
        rawUrl: typeof img?.url === 'string' ? img.url : '',
        public_id: img?.public_id != null ? String(img.public_id) : undefined,
        type: 'video' as const,
      }))
      .filter((v) => v.rawUrl && isVideoUrl(v.rawUrl))
      .map((v) => ({
        url: normalizeVideoContentUrl(v.rawUrl),
        public_id: v.public_id,
        type: v.type,
      }));

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
      // Video-only: no extra frame slide (cards use getListingDisplayImage). Listings that already
      // store frame thumbnails in images[] are handled above as stills via isCloudinaryVideoFrameThumbnailUrl.
      galleryMedia = [...videos, ...videosFromImages];
    } else {
      // Video first so the player is the prominent, above-the-fold content rendered in the
      // initial HTML (Google video indexing: the video must be the main content of a "watch
      // page" and visible without user interaction).
      galleryMedia = [...videos, ...videosFromImages, ...images];
    }

    const listingImages = getListingImagesForDisplay(
      rawImageItems as { url: string; public_id?: string }[],
      String(listing.propertyType ?? 'apartment'),
      rawVideoItems as { url?: string; public_id?: string }[]
    );
    const structuredImages = listingImages
      .map((img) => img.url)
      .filter(Boolean)
      .slice(0, 20);
    if (structuredImages.length === 0) {
      structuredImages.push(
        getListingDisplayImage(
          rawImageItems as { url?: string }[],
          String(listing.propertyType ?? 'apartment'),
          rawVideoItems as { url?: string; public_id?: string }[]
        )
      );
    }

    const isIndexable = isListingIndexable({
      images: (listing as { images?: { url?: string }[] }).images,
      videos: (listing as { videos?: { url?: string; public_id?: string }[] }).videos,
      description: listing.description,
    });

    const listingState = listing.location?.state ?? '';
    const listingCity = listing.location?.city ?? '';
    const listingPublicPath = getListingPublicPath({ _id: listingId, slug: publicSegment });
    const listingLocationDisplay = formatListingLocationDisplay(listing.location);
    const locationLinks = listingState
      ? relatedLocationLinks(listingState, listingCity ? { city: listingCity } : undefined)
      : [];

    const galleryVideosForSeo = collectListingGalleryVideos(
      rawImageItems as { url?: string; public_id?: string }[],
      rawVideoItems as { url?: string; public_id?: string }[]
    );
    const listingVideoSeoItems = buildListingVideoSeoItems({
      title: String(listing.title ?? ''),
      description: plainTextExcerpt(String(listing.description ?? ''), 2048, String(listing.title ?? '')),
      pagePath: listingPublicPath,
      uploadDate: listing.createdAt ? new Date(listing.createdAt as Date).toISOString() : undefined,
      videos: galleryVideosForSeo,
    });

    return (
    <>
      <JsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Listings', path: '/listings' },
            ...(listingState
              ? [{ name: listingState, path: buildLocationLandingPath(listingState) }]
              : []),
            ...(listingCity && listingState
              ? [{ name: listingCity, path: buildLocationLandingPath(listingState, { city: listingCity }) }]
              : []),
            { name: String(listing.title ?? 'Property'), path: listingPublicPath },
          ]),
          ...(isIndexable
            ? [
                buildListingJsonLd({
                  id: listingId,
                  slug: publicSegment,
                  title: String(listing.title ?? ''),
                  description: plainTextExcerpt(String(listing.description ?? ''), 500, String(listing.title ?? '')),
                  price: Number(listing.price) || 0,
                  listingType: String(listing.listingType ?? ''),
                  propertyType: String(listing.propertyType ?? ''),
                  imageUrls: structuredImages,
                  bedrooms: Number(listing.bedrooms) || undefined,
                  bathrooms: Number(listing.bathrooms) || undefined,
                  location: {
                    address: listing.location?.address,
                    city: listing.location?.city,
                    state: listing.location?.state,
                    suburb: listing.location?.suburb,
                  },
                  datePosted: listing.createdAt ? new Date(listing.createdAt as Date).toISOString() : undefined,
                  dateModified: listing.updatedAt ? new Date(listing.updatedAt as Date).toISOString() : undefined,
                }),
              ]
            : []),
        ]}
      />
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {isOwner && listing.status === LISTING_STATUS.PENDING_APPROVAL ? (
        <div className="mb-6">
          <ListingOwnerStatusBanner
            status={String(listing.status)}
            pendingApprovalReasons={
              Array.isArray((listing as { pendingApprovalReasons?: string[] }).pendingApprovalReasons)
                ? (listing as { pendingApprovalReasons: string[] }).pendingApprovalReasons
                : undefined
            }
          />
        </div>
      ) : null}
      {isOwner && listing.status === LISTING_STATUS.ACTIVE ?
        <div className="mb-6">
          <ListingIndexabilityBanner
            editHref={`/listings/${publicSegment}/edit`}
            images={(listing as { images?: { url?: string }[] }).images}
            videos={(listing as { videos?: { url?: string; public_id?: string }[] }).videos}
            description={listing.description}
          />
        </div>
      : null}
      <div className="grid min-w-0 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <ListingImageGallery
              images={galleryMedia}
              title={listing.title}
              locationLabel={listingLocationDisplay.trim() ? listingLocationDisplay : undefined}
              isBoosted={isBoosted}
              soldAt={listing.soldAt}
              rentedAt={listing.rentedAt}
            />
            {listingVideoSeoItems.length > 0 ? (
              <div className="border-t border-gray-100 px-6 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Property videos</h2>
                <ul className="mt-2 space-y-1">
                  {listingVideoSeoItems.map((item) => (
                    <li key={item.watchPagePath}>
                      <Link href={item.watchPagePath} className="text-sm font-medium text-primary-700 hover:underline">
                        Watch {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="p-6">
              <div className="flex flex-wrap items-start gap-3">
                <ListingTitleWithVerifiedBadge
                  title={listing.title}
                  createdBy={publicCreatedBy}
                  showVerifiedBadge={!isBotListing}
                />
                <ListingMarketStatusSticker
                  soldAt={listing.soldAt}
                  rentedAt={listing.rentedAt}
                  variant="inline"
                />
              </div>
              <p className="mt-2 text-2xl font-bold text-primary-600">
                {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(listing.price)}
                {listing.listingType === 'rent' && listing.rentPeriod && (
                  <span className="ml-2 text-base font-normal text-gray-600">
                    / {listing.rentPeriod === 'day' ? 'day' : listing.rentPeriod === 'month' ? 'month' : 'year'}
                  </span>
                )}
              </p>
              <ListingTrustCaveat
                className="mt-3"
                variant="detail"
                role={publicCreatedBy?.role}
                createdByType={listing.createdByType}
                isVerifiedAccount={publicCreatedBy?.isVerifiedAccount}
              />
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
              {listing.description && /<[a-z][\s\S]*>/i.test(listing.description) ? (
                <div
                  className="rich-html-content mt-4 text-gray-700 prose prose-slate max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 prose-img:max-w-full prose-table:my-4 prose-table:border-collapse prose-th:border prose-td:border prose-a:text-primary-600"
                  dangerouslySetInnerHTML={{ __html: listing.description }}
                />
              ) : (
                <div className="mt-4 text-gray-700 prose prose-slate max-w-none prose-p:my-2">
                  <p>{listing.description}</p>
                </div>
              )}
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
              {locationLinks.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900">Explore {listingCity || listingState}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {locationLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700 hover:bg-primary-100"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <SocialShareButtons
                  url={`${baseUrl}${listingPublicPath}`}
                  title={listing.title}
                  text={shareDescription}
                  mediaUrl={getListingDisplayImage(
                    rawImageItems as { url?: string }[],
                    String(listing.propertyType ?? 'apartment'),
                    rawVideoItems as { url?: string; public_id?: string }[]
                  )}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <div className="card min-w-0 overflow-hidden p-6">
            <h3 className="font-semibold text-gray-900">Location</h3>
            <p className="mt-2 text-gray-600">
              {listingLocationDisplay}
            </p>
            <ListingLocationMap
              mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
              addressLine={listingLocationDisplay}
              coordinates={listing.location?.coordinates}
            />
            <ListingSidebarTabs
              listingId={listingId}
              listingType={String(listing.listingType ?? '')}
              listingTitle={listing.title}
              propertyType={String(listing.propertyType ?? '')}
              listingDescription={listing.description ?? ''}
              locationDisplay={listingLocationDisplay}
              title={listing.title}
              createdBy={publicCreatedBy}
              createdByType={listing.createdByType ?? 'user'}
              listingTags={listing.tags}
              isBotListing={isBotListing}
              baseUrl={baseUrl}
              isOwner={isOwner}
              viewCount={listing.viewCount ?? 0}
              likeCount={likeCount}
            />
            {canEditListing && (
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

      <FeaturedSlot placement="listing_detail" hideWhenEmpty />

      {similarListings.length > 0 && (
        <SimilarListingsInfinite listingId={listingId} initialListings={similarListings} />
      )}
    </div>
    </>
    );
  } catch (e) {
    if (isNextNavigationError(e)) throw e;
    console.error('[ListingPage]', e);
    notFound();
  }
}
