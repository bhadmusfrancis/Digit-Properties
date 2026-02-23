import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import Listing from '@/models/Listing';
import Claim from '@/models/Claim';
import { USER_ROLES } from '@/lib/constants';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await dbConnect();
    const [usersCount, listingsCount, pendingClaims] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments(),
      Claim.countDocuments({ status: 'pending' }),
    ]);
    return NextResponse.json({ usersCount, listingsCount, pendingClaims });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load admin stats' }, { status: 500 });
  }
}
