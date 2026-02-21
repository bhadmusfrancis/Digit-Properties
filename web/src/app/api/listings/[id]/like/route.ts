import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import ListingLike from '@/models/ListingLike';
import mongoose from 'mongoose';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required to like' }, { status: 401 });
    }

    const { id: listingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findById(listingId).select('_id').lean();
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const userId = new mongoose.Types.ObjectId(session.user.id);
    const lid = new mongoose.Types.ObjectId(listingId);
    const existing = await ListingLike.findOne({ userId, listingId: lid });
    if (existing) {
      await ListingLike.deleteOne({ _id: existing._id });
    } else {
      await ListingLike.create({ userId, listingId: lid });
    }
    const likeCount = await ListingLike.countDocuments({ listingId: lid });
    return NextResponse.json({ liked: !existing, likeCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    const { id: listingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }
    await dbConnect();
    const lid = new mongoose.Types.ObjectId(listingId);
    const [likeCount, liked] = await Promise.all([
      ListingLike.countDocuments({ listingId: lid }),
      session?.user?.id
        ? ListingLike.findOne({ listingId: lid, userId: new mongoose.Types.ObjectId(session.user.id) }).lean()
        : null,
    ]);
    return NextResponse.json({
      likeCount,
      liked: !!liked,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to get like count' }, { status: 500 });
  }
}
