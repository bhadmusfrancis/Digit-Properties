import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await dbConnect();

    const url = new URL(req.url);
    const rawPage = parseInt(url.searchParams.get('page') || '1', 10);
    const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
    const rawLimit = parseInt(url.searchParams.get('limit') || String(DEFAULT_PER_PAGE), 10);
    const limit = Math.min(
      MAX_PER_PAGE,
      Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_PER_PAGE)
    );

    const total = await Listing.countDocuments({});
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(totalPages, page);
    const skip = (safePage - 1) * limit;

    const listings = await Listing.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .lean();
    const users = await User.find({}).select('_id name email').sort({ name: 1 }).limit(500).lean();
    const userList = users.map((u) => ({ _id: String(u._id), name: u.name, email: u.email }));
    const data = listings.map((l) => ({
      ...l,
      _id: String(l._id),
      createdBy: l.createdBy && typeof l.createdBy === 'object'
        ? { _id: String((l.createdBy as { _id?: unknown })._id), name: (l.createdBy as { name?: string }).name, email: (l.createdBy as { email?: string }).email }
        : l.createdBy,
      formattedPrice: formatPrice(l.price, l.listingType === 'rent' ? l.rentPeriod : undefined),
    }));
    return NextResponse.json({
      listings: data,
      users: userList,
      total,
      page: safePage,
      totalPages,
      limit,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load listings' }, { status: 500 });
  }
}
