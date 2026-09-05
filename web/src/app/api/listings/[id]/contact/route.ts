import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { canViewListingOnSite } from '@/lib/listing-access';
import { resolvePublicListingContact } from '@/lib/listing-contact-display';
import { requireVerifiedSession } from '@/lib/require-verified-session';
import { findListingByPublicParam } from '@/lib/resolve-listing';
import mongoose from 'mongoose';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVerifiedSession(req);
    if (!auth.ok) return auth.response;
    const session = auth.session;
    await dbConnect();

    const { id } = await params;
    let listingId = id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const found = await findListingByPublicParam(id);
      if (found.type === 'gone') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      listingId = String(found.listing._id);
    }

    const listing = await Listing.findById(listingId)
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
