import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { canViewListingOnSite } from '@/lib/listing-access';
import { resolvePublicListingContact } from '@/lib/listing-contact-display';
import mongoose from 'mongoose';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    await dbConnect();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const listing = await Listing.findById(id)
      .select(
        'status agentName agentPhone agentEmail title createdBy contactSource createdByType tags'
      )
      .populate('createdBy', 'firstName name phone email role')
      .lean();
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (
      !canViewListingOnSite({
        status: listing.status,
        createdBy: listing.createdBy,
        session,
      })
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const contact = resolvePublicListingContact({
      agentName: listing.agentName,
      agentPhone: listing.agentPhone,
      agentEmail: listing.agentEmail,
      contactSource: (listing as { contactSource?: string }).contactSource,
      createdByType: (listing as { createdByType?: string }).createdByType,
      createdBy: listing.createdBy,
      tags: (listing as { tags?: string[] }).tags,
    });
    return NextResponse.json({
      ...contact,
      title: listing.title,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 });
  }
}
