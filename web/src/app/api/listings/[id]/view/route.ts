import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { canViewListingOnSite } from '@/lib/listing-access';
import mongoose from 'mongoose';

/**
 * Records a page view for the listing. Call once per visit from the client.
 * Does not require auth so anonymous views are counted.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    await dbConnect();
    const session = await getSession(req);
    const pre = await Listing.findById(id).select('status createdBy').lean();
    if (!pre) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (
      !canViewListingOnSite({
        status: pre.status,
        createdBy: pre.createdBy,
        session,
      })
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const listing = await Listing.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .select('viewCount')
      .lean();
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ viewCount: (listing as { viewCount?: number }).viewCount ?? 0 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
  }
}
