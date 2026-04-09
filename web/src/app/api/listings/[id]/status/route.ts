import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { LISTING_STATUS, USER_ROLES } from '@/lib/constants';
import { sendAdminNewListing } from '@/lib/email';
import { notifyMatchingAlerts } from '@/lib/alerts';
import mongoose from 'mongoose';
import { getListingModerationConfig } from '@/lib/listing-moderation-config';

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
    const userRequestedActiveFromDraft = wasDraft && status === 'active';
    if (status && ['draft', 'active', 'paused', 'closed'].includes(status)) {
      listing.status = status as 'draft' | 'active' | 'paused' | 'closed';
    }
    if (
      !isAdmin &&
      session.user.role !== USER_ROLES.BOT &&
      wasDraft &&
      listing.status === LISTING_STATUS.ACTIVE
    ) {
      const mod = await getListingModerationConfig();
      if (mod.newListingsRequireApproval) {
        listing.status = LISTING_STATUS.PENDING_APPROVAL;
      }
    }
    if (soldAt === true && rentedAt === true) {
      return NextResponse.json({ error: 'Listing cannot be sold and rented at the same time' }, { status: 400 });
    }
    if (typeof soldAt === 'boolean') {
      if (listing.listingType === 'rent' && soldAt) {
        return NextResponse.json({ error: 'Rent listings cannot be marked as sold' }, { status: 400 });
      }
      listing.soldAt = soldAt ? new Date() : undefined;
      if (soldAt) listing.rentedAt = undefined;
    }
    if (typeof rentedAt === 'boolean') {
      if (listing.listingType !== 'rent' && rentedAt) {
        return NextResponse.json({ error: 'Only rent listings can be marked as rented' }, { status: 400 });
      }
      listing.rentedAt = rentedAt ? new Date() : undefined;
      if (rentedAt) listing.soldAt = undefined;
    }
    await listing.save();

    const nowActive = listing.status === LISTING_STATUS.ACTIVE;
    const nowPending = listing.status === LISTING_STATUS.PENDING_APPROVAL;
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
    } else if (wasDraft && nowPending && userRequestedActiveFromDraft) {
      const creator = await User.findById(listing.createdBy).lean();
      sendAdminNewListing(
        listing.title,
        String(listing._id),
        creator?.name || 'Unknown',
        listing.listingType,
        listing.price
      ).catch((e) => console.error('[listings] admin email:', e));
    }

    return NextResponse.json(listing);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
