import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { listingSchema } from '@/lib/validations';
import { LISTING_STATUS, USER_ROLES } from '@/lib/constants';

const CAN_CREATE = [USER_ROLES.ADMIN, USER_ROLES.VERIFIED_INDIVIDUAL, USER_ROLES.REGISTERED_AGENT, USER_ROLES.REGISTERED_DEVELOPER];

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '12', 10));
    const listingType = searchParams.get('listingType');
    const propertyType = searchParams.get('propertyType');
    const rentPeriod = searchParams.get('rentPeriod');
    const state = searchParams.get('state');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const bedrooms = searchParams.get('bedrooms');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const q = searchParams.get('q');

    const filter: Record<string, unknown> = { status: LISTING_STATUS.ACTIVE };
    if (listingType) filter.listingType = listingType;
    if (propertyType) filter.propertyType = propertyType;
    if (rentPeriod) filter.rentPeriod = rentPeriod;
    if (state) filter['location.state'] = state;
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
    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .sort({ boostExpiresAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name image role')
        .lean(),
      Listing.countDocuments(filter),
    ]);

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
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !(CAN_CREATE as readonly string[]).includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = listingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.create({
      ...parsed.data,
      status: parsed.data.status || LISTING_STATUS.DRAFT,
      createdBy: session.user.id,
      createdByType: session.user.role === USER_ROLES.ADMIN ? 'admin' : 'user',
    });

    return NextResponse.json(listing);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 });
  }
}
