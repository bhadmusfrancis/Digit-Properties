import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import ListingConversation from '@/models/ListingConversation';
import { requireVerifiedSession } from '@/lib/require-verified-session';

export async function GET(req: Request) {
  try {
    const auth = await requireVerifiedSession(req);
    if (!auth.ok) return auth.response;

    await dbConnect();
    const userId = new mongoose.Types.ObjectId(auth.userId);
    const [asBuyer, asOwner] = await Promise.all([
      ListingConversation.aggregate([
        { $match: { buyerId: userId } },
        { $group: { _id: null, total: { $sum: '$unreadByBuyer' } } },
      ]),
      ListingConversation.aggregate([
        { $match: { listingOwnerId: userId } },
        { $group: { _id: null, total: { $sum: '$unreadByOwner' } } },
      ]),
    ]);

    const unread = (asBuyer[0]?.total ?? 0) + (asOwner[0]?.total ?? 0);
    return NextResponse.json({ unread });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load unread count' }, { status: 500 });
  }
}
