import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await dbConnect();
    const listings = await Listing.find({})
      .sort({ createdAt: -1 })
      .limit(100)
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
    return NextResponse.json({ listings: data, users: userList });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load listings' }, { status: 500 });
  }
}
