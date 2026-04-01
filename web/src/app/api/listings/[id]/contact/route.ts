import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { toFirstName } from '@/lib/display-name';
import mongoose from 'mongoose';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required to view contact details' }, { status: 401 });
    }
    await dbConnect();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const listing = await Listing.findById(id)
      .select('agentName agentPhone agentEmail title createdBy contactSource')
      .populate('createdBy', 'firstName name phone email')
      .lean();
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const creator = listing.createdBy as { firstName?: string; name?: string; phone?: string; email?: string } | null;
    const src = (listing as { contactSource?: string }).contactSource === 'listing' ? 'listing' : 'author';
    const hasListingContact = [listing.agentName, listing.agentPhone, listing.agentEmail].some(Boolean);
    const useListingContact = src === 'listing' && hasListingContact;
    return NextResponse.json({
      agentName: useListingContact
        ? (listing.agentName ?? '')
        : toFirstName(creator?.firstName, creator?.name, listing.agentName ?? ''),
      agentPhone: useListingContact ? (listing.agentPhone ?? '') : (creator?.phone ?? listing.agentPhone),
      agentEmail: useListingContact ? (listing.agentEmail ?? '') : (creator?.email ?? listing.agentEmail),
      title: listing.title,
      contactSource: useListingContact ? 'listing' : 'author',
      hasListingContact,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 });
  }
}
