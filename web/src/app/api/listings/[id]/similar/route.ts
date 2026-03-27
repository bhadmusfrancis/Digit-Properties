import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { LISTING_STATUS } from '@/lib/constants';
import Listing from '@/models/Listing';
import User from '@/models/User';
import mongoose from 'mongoose';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

type SimilarListingItem = {
  _id: string;
  title: string;
  price: number;
  listingType: string;
  rentPeriod?: 'day' | 'month' | 'year';
  propertyType: string;
  location: { address: string; city: string; state: string; suburb?: string };
  bedrooms: number;
  bathrooms: number;
  toilets?: number;
  images: { url: string; public_id?: string }[];
  videos: { url: string; public_id?: string }[];
  isBoosted: boolean;
  createdBy?: { _id?: string; firstName?: string; name?: string; role?: string };
};

/** GET /api/listings/[id]/similar?skip=0&limit=12 — paginated similar listings (same propertyType, by proximity then date). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)));

    await dbConnect();
    void User;

    const current = await Listing.findById(id).select('propertyType location').lean();
    if (!current) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const currentCity = (current.location as { city?: string })?.city ?? '';
    const currentState = (current.location as { state?: string })?.state ?? '';
    const listingIdOid = new mongoose.Types.ObjectId(id);

    const pipeline: mongoose.PipelineStage[] = [
      {
        $match: {
          _id: { $ne: listingIdOid },
          status: LISTING_STATUS.ACTIVE,
          propertyType: current.propertyType ?? '',
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
      { $skip: skip },
      { $limit: limit + 1 },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdByDoc',
        },
      },
    ];

    const docs = await Listing.aggregate(pipeline).exec();
    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;

    const listings: SimilarListingItem[] = slice.map((doc: Record<string, unknown>) => {
      const createdByDoc = Array.isArray(doc.createdByDoc) ? doc.createdByDoc[0] : null;
      const cb = createdByDoc && typeof createdByDoc === 'object'
        ? (createdByDoc as { _id?: unknown; firstName?: string; name?: string; role?: string })
        : null;
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
        const o = img && typeof img === 'object' && img !== null ? (img as Record<string, unknown>) : {};
        return {
          url: typeof o.url === 'string' ? o.url : '',
          public_id: o.public_id != null ? String(o.public_id) : undefined,
        };
      });
      const rawVideos = Array.isArray(doc.videos) ? doc.videos : [];
      const videos = rawVideos.map((v: unknown) => {
        const o = v && typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
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

    return NextResponse.json({ listings, hasMore });
  } catch (e) {
    console.error('[listings/[id]/similar]', e);
    return NextResponse.json({ error: 'Failed to load similar listings' }, { status: 500 });
  }
}
