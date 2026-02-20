import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { LISTING_STATUS, USER_ROLES } from '@/lib/constants';
import { sendAdminNewListing } from '@/lib/email';
import { notifyMatchingAlerts } from '@/lib/alerts';
import mongoose from 'mongoose';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json();
    const { status, soldAt, rentedAt } = body as { status?: string; soldAt?: boolean; rentedAt?: boolean };

    await dbConnect();
    const listing = await Listing.findById(id);
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = session.user.role === USER_ROLES.ADMIN;
    const isOwner = listing.createdBy.toString() === session.user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const wasDraft = listing.status === LISTING_STATUS.DRAFT;
    if (status && ['draft', 'active', 'paused', 'closed'].includes(status)) {
      listing.status = status as 'draft' | 'active' | 'paused' | 'closed';
    }
    if (soldAt) listing.soldAt = new Date();
    if (rentedAt) listing.rentedAt = new Date();
    await listing.save();

    const nowActive = listing.status === LISTING_STATUS.ACTIVE;
    if (wasDraft && nowActive) {
      const creator = await User.findById(listing.createdBy).lean();
      sendAdminNewListing(
        listing.title,
        String(listing._id),
        creator?.name || 'Unknown',
        listing.listingType,
        listing.price
      ).catch((e) => console.error('[listings] admin email:', e));
      notifyMatchingAlerts(listing.toObject()).catch((e) => console.error('[listings] alerts:', e));
    }

    return NextResponse.json(listing);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
