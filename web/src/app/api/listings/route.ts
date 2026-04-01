import { NextResponse } from 'next/server';
import type { PipelineStage } from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing, { type IListing } from '@/models/Listing';
import User from '@/models/User';
import { listingSchema, listingQuerySchema } from '@/lib/validations';
import { LISTING_STATUS, USER_ROLES, SUBSCRIPTION_TIERS, POPULAR_AMENITIES } from '@/lib/constants';
import { sendAdminNewListing } from '@/lib/email';
import { notifyMatchingAlerts } from '@/lib/alerts';
import { getSubscriptionLimits } from '@/lib/subscription-limits';
import { extractAmenitiesFromText, mergeUniqueLists, normalizeList } from '@/lib/listing-amenities';
import { dedupeImagesByPublicId, findUserListingDuplicate } from '@/lib/listing-dedupe';

const CAN_CREATE = [USER_ROLES.ADMIN, USER_ROLES.BOT, USER_ROLES.GUEST, USER_ROLES.VERIFIED_INDIVIDUAL, USER_ROLES.REGISTERED_AGENT, USER_ROLES.REGISTERED_DEVELOPER];

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = listingQuerySchema.safeParse(raw);
    const mine = parsed.success ? parsed.data.mine === '1' : searchParams.get('mine') === '1';
    const page = parsed.success ? parsed.data.page : Math.max(1, Math.min(100, parseInt(searchParams.get('page') || '1', 10) || 1));
    const limit = parsed.success ? parsed.data.limit : Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '12', 10) || 12));
    const listingType = parsed.success ? parsed.data.listingType : searchParams.get('listingType')?.slice(0, 50);
    const propertyType = parsed.success ? parsed.data.propertyType : searchParams.get('propertyType')?.slice(0, 50);
    const rentPeriod = parsed.success ? parsed.data.rentPeriod : searchParams.get('rentPeriod')?.slice(0, 20);
    const state = parsed.success ? parsed.data.state : searchParams.get('state')?.slice(0, 100);
    const city = (parsed.success ? parsed.data.city : searchParams.get('city')?.trim())?.slice(0, 100);
    const suburb = (parsed.success ? parsed.data.suburb : searchParams.get('suburb')?.trim())?.slice(0, 100);
    const minPrice = parsed.success ? parsed.data.minPrice : searchParams.get('minPrice')?.slice(0, 20);
    const maxPrice = parsed.success ? parsed.data.maxPrice : searchParams.get('maxPrice')?.slice(0, 20);
    const bedrooms = parsed.success ? parsed.data.bedrooms : searchParams.get('bedrooms')?.slice(0, 10);
    const tagsRaw = parsed.success ? parsed.data.tags : searchParams.get('tags');
    const tags = normalizeList(tagsRaw?.split(',')).slice(0, 20);
    const q = (parsed.success ? parsed.data.q : searchParams.get('q'))?.trim()?.slice(0, 200);
    const featured = parsed.success ? parsed.data.featured === '1' : searchParams.get('featured') === '1';
    const highlighted = parsed.success ? parsed.data.highlighted === '1' : searchParams.get('highlighted') === '1';
    const random = parsed.success ? parsed.data.random === '1' : searchParams.get('random') === '1';

    let filter: Record<string, unknown>;
    if (mine) {
      const session = await getSession(req);
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      filter = { createdBy: session.user.id };
    } else {
      filter = { status: LISTING_STATUS.ACTIVE };
    }
    if (featured) filter.featured = true;
    if (highlighted) filter.highlighted = true;
    if (listingType) filter.listingType = listingType;
    if (propertyType) filter.propertyType = propertyType;
    if (rentPeriod) filter.rentPeriod = rentPeriod;
    if (state) filter['location.state'] = state;
    if (city) filter['location.city'] = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (suburb) filter['location.suburb'] = new RegExp(suburb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (minPrice && maxPrice) {
      filter.price = { $gte: parseInt(minPrice, 10), $lte: parseInt(maxPrice, 10) };
    } else if (minPrice) {
      filter.price = { $gte: parseInt(minPrice, 10) };
    } else if (maxPrice) {
      filter.price = { $lte: parseInt(maxPrice, 10) };
    }
    if (bedrooms) filter.bedrooms = { $gte: parseInt(bedrooms, 10) };
    if (tags?.length) filter.tags = { $in: tags };

    if (q && q.trim()) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
      ];
    }

    const skip = (page - 1) * limit;
    type ListingRow = Omit<IListing, 'createdBy'> & { createdBy?: IListing['createdBy'] | { firstName?: string; name?: string; image?: string; role?: string } };
    let listings: ListingRow[];
    let total: number;
    const hasRealMedia = (l: ListingRow) => {
      const imgOk =
        Array.isArray(l.images) &&
        l.images.some((img) => typeof img?.url === 'string' && img.url.trim().length > 0);
      const vidOk =
        Array.isArray((l as unknown as { videos?: IListing['videos'] }).videos) &&
        ((l as unknown as { videos?: Array<{ url?: string; public_id?: string }> }).videos ?? []).some(
          (v) => typeof v?.url === 'string' && v.url.trim().length > 0
        );
      return imgOk || vidOk;
    };
    const prioritizeMedia = (arr: ListingRow[]) =>
      [...arr].sort((a, b) => {
        const am = hasRealMedia(a);
        const bm = hasRealMedia(b);
        if (am === bm) return 0;
        return bm ? 1 : -1;
      });

    if (featured && random) {
      const all = await Listing.find(filter)
        .sort({ boostExpiresAt: -1, createdAt: -1 })
        .limit(Math.min(50, limit * 3))
        .populate('createdBy', 'firstName name image role')
        .lean();
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      listings = prioritizeMedia(shuffled).slice(0, limit);
      total = all.length;
    } else {
      const [listingsRes, totalRes] = await Promise.all([
        Listing.aggregate([
          { $match: filter } as PipelineStage,
          {
            $addFields: {
              _hasMedia: {
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
            },
          } as PipelineStage,
          { $sort: { _hasMedia: -1, boostExpiresAt: -1, createdAt: -1 } } as PipelineStage,
          { $skip: skip } as PipelineStage,
          { $limit: limit } as PipelineStage,
          {
            $lookup: {
              from: User.collection.name,
              localField: 'createdBy',
              foreignField: '_id',
              as: '_createdByArr',
              pipeline: [{ $project: { firstName: 1, name: 1, image: 1, role: 1 } }],
            },
          } as PipelineStage,
          { $addFields: { createdBy: { $arrayElemAt: ['$_createdByArr', 0] } } } as PipelineStage,
          { $project: { _createdByArr: 0, _hasMedia: 0 } } as PipelineStage,
        ]).allowDiskUse(true),
        Listing.countDocuments(filter),
      ]);
      listings = listingsRes as ListingRow[];
      total = totalRes;
    }

    return NextResponse.json({
      listings: listings.map((l) => ({
        ...l,
        createdBy: l.createdBy && typeof l.createdBy === 'object' && 'role' in l.createdBy
          ? {
              _id: (l.createdBy as { _id?: unknown })._id != null ? String((l.createdBy as { _id: unknown })._id) : undefined,
              firstName: (l.createdBy as { firstName?: string }).firstName,
              name: (l.createdBy as { name?: string }).name,
              image: (l.createdBy as { image?: string }).image,
              role: (l.createdBy as { role?: string }).role,
            }
          : l.createdBy,
        isBoosted: l.boostExpiresAt && new Date(l.boostExpiresAt) > new Date(),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    const limit = Math.min(50, parseInt(new URL(req.url).searchParams.get('limit') || '12', 10));
    return NextResponse.json({
      listings: [],
      pagination: { page: 1, limit, total: 0, pages: 0 },
    });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || !(CAN_CREATE as readonly string[]).includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = listingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(session.user.id).lean();
    const tier =
      session.user.role === USER_ROLES.ADMIN
        ? SUBSCRIPTION_TIERS.PREMIUM
        : (user?.subscriptionTier as string) ||
          (session.user.role === USER_ROLES.GUEST ? SUBSCRIPTION_TIERS.GUEST : session.user.role === USER_ROLES.BOT ? 'bot' : SUBSCRIPTION_TIERS.FREE);
    const limits = await getSubscriptionLimits(tier);

    const listingCount = await Listing.countDocuments({
      createdBy: session.user.id,
      status: { $in: [LISTING_STATUS.DRAFT, LISTING_STATUS.ACTIVE, LISTING_STATUS.PAUSED] },
    });
    if (listingCount >= limits.maxListings) {
      return NextResponse.json(
        {
          error: `You've reached the limit of ${limits.maxListings} listings for your plan.`,
          code: 'LISTING_LIMIT_REACHED',
        },
        { status: 403 }
      );
    }

    const rawImages = Array.isArray(parsed.data.images) ? parsed.data.images : [];
    const rawVideos = Array.isArray(parsed.data.videos) ? parsed.data.videos : [];
    const images = dedupeImagesByPublicId(
      rawImages
        .map((img: { url?: string; public_id?: string }) => ({
          url: typeof img?.url === 'string' ? img.url.trim() : '',
          public_id: typeof img?.public_id === 'string' ? img.public_id.trim() : '',
        }))
        .filter((img) => img.url && img.public_id)
    );
    const videos = dedupeImagesByPublicId(
      rawVideos
        .map((v: { url?: string; public_id?: string }) => ({
          url: typeof v?.url === 'string' ? v.url.trim() : '',
          public_id: typeof v?.public_id === 'string' ? v.public_id.trim() : '',
        }))
        .filter((v) => v.url && v.public_id)
    );
    if (images.length > limits.maxImages) {
      return NextResponse.json(
        { error: `Maximum ${limits.maxImages} images per listing for your plan.` },
        { status: 400 }
      );
    }
    if (videos.length > limits.maxVideos) {
      return NextResponse.json(
        { error: `Maximum ${limits.maxVideos} video(s) per listing for your plan.` },
        { status: 400 }
      );
    }

    const duplicateCheck = await findUserListingDuplicate(session.user.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      mediaPublicIds: [
        ...images.map((i) => i.public_id),
        ...videos.map((v) => v.public_id),
      ],
    });
    if (duplicateCheck) {
      return NextResponse.json(
        { error: duplicateCheck.message, code: duplicateCheck.code },
        { status: 409 }
      );
    }

    const amenitiesFromBody = normalizeList(parsed.data.amenities);
    const amenitiesFromText = extractAmenitiesFromText(
      `${parsed.data.title}\n${parsed.data.description}\n${(parsed.data.tags ?? []).join(', ')}`,
      POPULAR_AMENITIES
    );
    const amenities = mergeUniqueLists(amenitiesFromBody, amenitiesFromText);
    const tagsMerged = mergeUniqueLists(parsed.data.tags, amenities);
    const { images: _i, videos: _v, amenities: _a, tags: _t, ...rest } = parsed.data;
    const listing = await Listing.create({
      ...rest,
      amenities,
      tags: tagsMerged,
      images,
      videos: videos.length > 0 ? videos : [],
      status: parsed.data.status || LISTING_STATUS.DRAFT,
      createdBy: session.user.id,
      createdByType: session.user.role === USER_ROLES.ADMIN ? 'admin' : session.user.role === USER_ROLES.BOT ? 'bot' : 'user',
    });

    const isActive = (parsed.data.status || LISTING_STATUS.DRAFT) === LISTING_STATUS.ACTIVE;
    if (isActive) {
      const creator = await User.findById(session.user.id).lean();
      sendAdminNewListing(
        listing.title,
        String(listing._id),
        creator?.name || session.user.name || 'Unknown',
        listing.listingType,
        listing.price
      ).catch((e) => console.error('[listings] admin email:', e));
      notifyMatchingAlerts(listing.toObject()).catch((e) => console.error('[listings] alerts:', e));
    }

    const doc = listing.toObject ? listing.toObject() : listing;
    return NextResponse.json({ ...doc, images: (doc as { images?: unknown[] }).images ?? images });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 });
  }
}
