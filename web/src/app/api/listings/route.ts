import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { listingSchema } from '@/lib/validations';
import { LISTING_STATUS, USER_ROLES, SUBSCRIPTION_TIERS } from '@/lib/constants';
import { sendAdminNewListing } from '@/lib/email';
import { notifyMatchingAlerts } from '@/lib/alerts';
import { getSubscriptionLimits } from '@/lib/subscription-limits';

const CAN_CREATE = [USER_ROLES.ADMIN, USER_ROLES.GUEST, USER_ROLES.VERIFIED_INDIVIDUAL, USER_ROLES.REGISTERED_AGENT, USER_ROLES.REGISTERED_DEVELOPER];

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const mine = searchParams.get('mine') === '1';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '12', 10));
    const listingType = searchParams.get('listingType');
    const propertyType = searchParams.get('propertyType');
    const rentPeriod = searchParams.get('rentPeriod');
    const state = searchParams.get('state');
    const city = searchParams.get('city')?.trim();
    const suburb = searchParams.get('suburb')?.trim();
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const bedrooms = searchParams.get('bedrooms');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const q = searchParams.get('q');
    const featured = searchParams.get('featured') === '1';
    const highlighted = searchParams.get('highlighted') === '1';
    const random = searchParams.get('random') === '1';

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
    let listings: Awaited<ReturnType<typeof Listing.find>> extends Promise<infer U> ? U : never;
    let total: number;

    if (featured && random) {
      const all = await Listing.find(filter)
        .sort({ boostExpiresAt: -1, createdAt: -1 })
        .limit(Math.min(50, limit * 3))
        .populate('createdBy', 'name image role')
        .lean();
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      listings = shuffled.slice(0, limit);
      total = all.length;
    } else {
      const [listingsRes, totalRes] = await Promise.all([
        Listing.find(filter)
          .sort({ boostExpiresAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name image role')
          .lean(),
        Listing.countDocuments(filter),
      ]);
      listings = listingsRes;
      total = totalRes;
    }

    return NextResponse.json({
      listings: listings.map((l) => ({
        ...l,
        createdBy: l.createdBy && typeof l.createdBy === 'object' && 'role' in l.createdBy
          ? { name: (l.createdBy as { name?: string }).name, image: (l.createdBy as { image?: string }).image, role: (l.createdBy as { role?: string }).role }
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
          (session.user.role === USER_ROLES.GUEST ? SUBSCRIPTION_TIERS.GUEST : SUBSCRIPTION_TIERS.FREE);
    const limits = await getSubscriptionLimits(tier);

    const listingCount = await Listing.countDocuments({
      createdBy: session.user.id,
      status: { $in: [LISTING_STATUS.DRAFT, LISTING_STATUS.ACTIVE, LISTING_STATUS.PAUSED] },
    });
    if (listingCount >= limits.maxListings) {
      return NextResponse.json(
        { error: `Listing limit reached (${limits.maxListings} for your plan). Upgrade for more.` },
        { status: 403 }
      );
    }

    const rawImages = Array.isArray(parsed.data.images) ? parsed.data.images : [];
    const rawVideos = Array.isArray(parsed.data.videos) ? parsed.data.videos : [];
    const images = rawImages
      .map((img: { url?: string; public_id?: string }) => ({
        url: typeof img?.url === 'string' ? img.url.trim() : '',
        public_id: typeof img?.public_id === 'string' ? img.public_id.trim() : '',
      }))
      .filter((img) => img.url && img.public_id);
    const videos = rawVideos
      .map((v: { url?: string; public_id?: string }) => ({
        url: typeof v?.url === 'string' ? v.url.trim() : '',
        public_id: typeof v?.public_id === 'string' ? v.public_id.trim() : '',
      }))
      .filter((v) => v.url && v.public_id);
    if (rawImages.length > limits.maxImages) {
      return NextResponse.json(
        { error: `Maximum ${limits.maxImages} images per listing for your plan.` },
        { status: 400 }
      );
    }
    if (rawVideos.length > limits.maxVideos) {
      return NextResponse.json(
        { error: `Maximum ${limits.maxVideos} video(s) per listing for your plan.` },
        { status: 400 }
      );
    }

    const { images: _i, videos: _v, ...rest } = parsed.data;
    const listing = await Listing.create({
      ...rest,
      images,
      videos: videos.length > 0 ? videos : [],
      status: parsed.data.status || LISTING_STATUS.DRAFT,
      createdBy: session.user.id,
      createdByType: session.user.role === USER_ROLES.ADMIN ? 'admin' : 'user',
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
