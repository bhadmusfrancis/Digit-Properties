import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { isClaimableListingDoc } from '@/lib/claimable-listing';
import { formatPhoneClaimHint } from '@/lib/claim-phone-suffix';
import { getListingClaimPhone } from '@/lib/listing-claim-phone';
import mongoose from 'mongoose';

/** GET /api/claims/phone-hint?listingId= — masked prefix of listing contact phone for claim UI */
export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const listingId = new URL(req.url).searchParams.get('listingId');
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findById(listingId)
      .select('agentPhone agentEmail contactSource createdByType createdBy')
      .populate('createdBy', 'phone role')
      .lean();
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    if (!isClaimableListingDoc(listing)) {
      return NextResponse.json({ error: 'This listing cannot be claimed' }, { status: 400 });
    }

    const phone = getListingClaimPhone(listing);
    if (!phone) {
      return NextResponse.json({ error: 'This listing has no contact phone to verify' }, { status: 400 });
    }

    return NextResponse.json({
      phoneHint: formatPhoneClaimHint(phone),
      hasPhone: true,
    });
  } catch (e) {
    console.error('[claims/phone-hint]', e);
    return NextResponse.json({ error: 'Failed to load phone hint' }, { status: 500 });
  }
}
