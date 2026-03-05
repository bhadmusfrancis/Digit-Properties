import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import UserAd from '@/models/UserAd';
import { AD_PLACEMENTS, USER_AD_STATUS } from '@/lib/constants';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const placement = searchParams.get('placement');
    const from = searchParams.get('from'); // ISO date or datetime
    const to = searchParams.get('to');

    if (!placement || !AD_PLACEMENTS.includes(placement as (typeof AD_PLACEMENTS)[number])) {
      return NextResponse.json({ error: 'Invalid or missing placement' }, { status: 400 });
    }

    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate >= toDate) {
      return NextResponse.json({ error: 'Invalid from/to range' }, { status: 400 });
    }

    await dbConnect();
    const booked = await UserAd.find({
      placement,
      status: USER_AD_STATUS.APPROVED,
      $or: [
        { startDate: { $lt: toDate }, endDate: { $gt: fromDate } },
      ],
    })
      .select('startDate endDate')
      .lean();

    const ranges = booked.map((b) => ({
        start: (b as { startDate: Date }).startDate,
        end: (b as { endDate: Date }).endDate,
      }));

    return NextResponse.json({ ranges });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}
