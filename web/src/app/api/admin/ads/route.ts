import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import UserAd from '@/models/UserAd';
import { USER_ROLES } from '@/lib/constants';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    await dbConnect();
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const ads = await UserAd.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .lean();
    const list = ads.map((a) => {
      const row = a as { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId | { name?: string; email?: string } };
      return {
        ...a,
        _id: row._id.toString(),
        userId: row.userId && typeof row.userId === 'object' && '_id' in row.userId
          ? (row.userId as mongoose.Types.ObjectId).toString()
          : row.userId,
      };
    });
    return NextResponse.json({ ads: list });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to list ads' }, { status: 500 });
  }
}
