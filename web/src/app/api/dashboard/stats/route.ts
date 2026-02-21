import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import Claim from '@/models/Claim';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    const [listingsCount, claimsCount] = await Promise.all([
      Listing.countDocuments({ createdBy: session.user.id }),
      Claim.countDocuments({ userId: session.user.id, status: 'pending' }),
    ]);
    return NextResponse.json({ listingsCount, claimsCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
