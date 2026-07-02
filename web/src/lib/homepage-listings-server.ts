import type { PipelineStage } from 'mongoose';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import Trend from '@/models/Trend';
import { LISTING_STATUS, TREND_STATUS } from '@/lib/constants';
import { LISTING_HAS_MEDIA_FIELD, LISTING_MARKET_AVAILABLE_FIELD } from '@/lib/listing-proximity-sort';
import { shapePublicCreatedBy, USER_PUBLIC_BADGE_FIELDS } from '@/lib/verification';

export type HomeListingRow = {
  _id: string;
  slug?: string;
  title: string;
  price: number;
  listingType: string;
  rentPeriod?: 'day' | 'month' | 'year';
  propertyType: string;
  propertyTypes?: string[];
  location: { city?: string; state?: string; suburb?: string };
  bedrooms: number;
  bathrooms: number;
  toilets?: number;
  images?: { url: string }[];
  videos?: { url: string; public_id?: string }[];
  isBoosted?: boolean;
  createdBy?: { name?: string; role?: string; isVerifiedAccount?: boolean };
};

function mapListingRow(l: {
  _id: { toString(): string } | string;
  createdBy?: unknown;
  boostExpiresAt?: Date;
  images?: Array<{ url?: string; public_id?: string; _id?: unknown }>;
  videos?: Array<{ url?: string; public_id?: string; _id?: unknown }>;
  location?: { city?: string; state?: string; suburb?: string };
  propertyTypes?: string[];
  title?: string;
  slug?: string;
  price?: number;
  listingType?: string;
  rentPeriod?: 'day' | 'month' | 'year';
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
}): HomeListingRow {
  const shaped = shapePublicCreatedBy(l.createdBy);
  return {
    _id: typeof l._id === 'string' ? l._id : l._id.toString(),
    slug: l.slug,
    title: l.title ?? '',
    price: typeof l.price === 'number' ? l.price : 0,
    listingType: l.listingType ?? 'sale',
    rentPeriod: l.rentPeriod,
    propertyType: l.propertyType ?? '',
    propertyTypes: Array.isArray(l.propertyTypes) ? l.propertyTypes.map(String) : undefined,
    location: {
      city: l.location?.city,
      state: l.location?.state,
      suburb: l.location?.suburb,
    },
    bedrooms: l.bedrooms ?? 0,
    bathrooms: l.bathrooms ?? 0,
    toilets: l.toilets,
    images: (l.images ?? [])
      .map((img) => (typeof img?.url === 'string' && img.url.trim() ? { url: img.url.trim() } : null))
      .filter((img): img is { url: string } => img !== null),
    videos: (l.videos ?? [])
      .map((vid) => {
        const url = typeof vid?.url === 'string' ? vid.url.trim() : '';
        if (!url) return null;
        const public_id = typeof vid.public_id === 'string' ? vid.public_id : undefined;
        return public_id ? { url, public_id } : { url };
      })
      .filter((vid): vid is { url: string; public_id?: string } => vid !== null),
    isBoosted: Boolean(l.boostExpiresAt && new Date(l.boostExpiresAt) > new Date()),
    createdBy: shaped
      ? { name: shaped.name ?? shaped.firstName, role: shaped.role, isVerifiedAccount: shaped.isVerifiedAccount }
      : undefined,
  };
}

export async function fetchHomeFeaturedListings(limit = 8): Promise<HomeListingRow[]> {
  if (!process.env.MONGODB_URI?.trim()) return [];
  await dbConnect();
  const rows = await Listing.find({
    status: LISTING_STATUS.ACTIVE,
    $or: [{ featured: true }, { highlighted: true }],
  })
    .sort({ 'images.0.url': -1, createdAt: -1 })
    .limit(limit)
    .select(
      'title slug price listingType rentPeriod propertyType propertyTypes location bedrooms bathrooms toilets images videos boostExpiresAt createdBy'
    )
    .populate('createdBy', USER_PUBLIC_BADGE_FIELDS)
    .lean();
  if (rows.length >= 4) {
    return rows.map((l) => mapListingRow(l as Parameters<typeof mapListingRow>[0]));
  }
  const fallback = await Listing.find({ status: LISTING_STATUS.ACTIVE })
    .sort({ 'images.0.url': -1, viewCount: -1, createdAt: -1 })
    .limit(limit)
    .select(
      'title slug price listingType rentPeriod propertyType propertyTypes location bedrooms bathrooms toilets images videos boostExpiresAt createdBy'
    )
    .populate('createdBy', USER_PUBLIC_BADGE_FIELDS)
    .lean();
  return fallback.map((l) => mapListingRow(l as Parameters<typeof mapListingRow>[0]));
}

export async function fetchHomeTrendingListings(limit = 8): Promise<HomeListingRow[]> {
  if (!process.env.MONGODB_URI?.trim()) return [];
  await dbConnect();
  const aggPipeline: PipelineStage[] = [
    { $match: { status: LISTING_STATUS.ACTIVE } },
    {
      $addFields: {
        ...LISTING_MARKET_AVAILABLE_FIELD,
        ...LISTING_HAS_MEDIA_FIELD,
      },
    },
    { $sort: { _isMarketAvailable: -1, _hasMedia: -1, viewCount: -1, createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'createdByDoc',
        pipeline: [{ $project: { firstName: 1, name: 1, image: 1, role: 1, verifiedAt: 1, phoneVerifiedAt: 1, identityVerifiedAt: 1, livenessVerifiedAt: 1 } }],
      },
    },
    { $set: { createdBy: { $arrayElemAt: ['$createdByDoc', 0] } } },
    { $unset: ['createdByDoc', '_isMarketAvailable', '_hasMedia'] },
  ];
  const listings = await Listing.aggregate(aggPipeline);
  return listings.map((l) => mapListingRow(l as Parameters<typeof mapListingRow>[0]));
}

export type HomeTrendPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  publishedAt?: string;
};

export async function fetchHomeTrendPosts(limit = 4): Promise<HomeTrendPost[]> {
  if (!process.env.MONGODB_URI?.trim()) return [];
  await dbConnect();
  const posts = await Trend.find({ status: TREND_STATUS.PUBLISHED })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit)
    .select('title slug excerpt category publishedAt')
    .lean();
  return posts.map((p) => ({
    _id: String(p._id),
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? '',
    category: p.category,
    publishedAt: p.publishedAt?.toISOString(),
  }));
}
