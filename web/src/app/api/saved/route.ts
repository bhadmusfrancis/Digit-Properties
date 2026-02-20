import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import SavedListing from '@/models/SavedListing';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const saved = await SavedListing.find({ userId: session.user.id })
      .populate('listingId')
      .lean();
    return NextResponse.json(saved.map((s) => s.listingId).filter(Boolean));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch saved' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { listingId } = body as { listingId?: string };
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return NextResponse.json({ error: 'Invalid listingId' }, { status: 400 });
    }

    await dbConnect();
    const existing = await SavedListing.findOne({
      userId: session.user.id,
      listingId,
    });
    if (existing) {
      await SavedListing.findByIdAndDelete(existing._id);
      return NextResponse.json({ saved: false });
    }
    await SavedListing.create({ userId: session.user.id, listingId });
    return NextResponse.json({ saved: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to toggle save' }, { status: 500 });
  }
}
