import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import SavedListing from '@/models/SavedListing';
import Listing from '@/models/Listing';
import mongoose from 'mongoose';
import { savedListingSchema } from '@/lib/validations';

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
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = savedListingSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json({ error: first?.message ?? 'Invalid listingId' }, { status: 400 });
    }
    const { listingId } = parsed.data;

    await dbConnect();
    const listing = await Listing.findById(listingId).select('createdBy').lean();
    if (listing) {
      const createdById = listing.createdBy != null ? String(listing.createdBy) : '';
      if (createdById === session.user.id) {
        return NextResponse.json({ error: 'You cannot add your own listing to favorites' }, { status: 403 });
      }
    }
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
    return NextResponse.json({ error: 'Failed to update favorites' }, { status: 500 });
  }
}
