import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { LISTING_STATUS, USER_ROLES } from '@/lib/constants';
import mongoose from 'mongoose';
import {
  notifyAdminListingPublish,
  notifyAlertsIfActive,
  resolvePublishStatus,
} from '@/lib/listing-publish-moderation';

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
    const isBot = session.user.role === USER_ROLES.BOT;
    if (!isAdmin && !isBot && wasDraft && listing.status === LISTING_STATUS.ACTIVE) {
      const publishMod = await resolvePublishStatus(
        {
          title: listing.title,
          description: listing.description,
          listingType: listing.listingType,
          propertyType: listing.propertyType,
          propertyTypes: listing.propertyTypes,
          price: listing.price,
          rentPeriod: listing.rentPeriod,
          location: listing.location,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          toilets: listing.toilets,
          tags: listing.tags,
          amenities: listing.amenities,
        },
        { isAdmin, isBot, requestedPublish: true, previousStatus: LISTING_STATUS.DRAFT }
      );
      listing.status = publishMod.status;
      if (publishMod.suspicionReasons.length > 0) {
        listing.pendingApprovalReasons = publishMod.suspicionReasons;
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
    if (wasDraft && (nowActive || nowPending) && userRequestedActiveFromDraft) {
      const creator = await User.findById(listing.createdBy).lean();
      await notifyAdminListingPublish({
        listingId: String(listing._id),
        title: listing.title,
        listingType: listing.listingType,
        price: listing.price,
        createdByName: creator?.name || 'Unknown',
        status: listing.status,
        suspicionReasons: listing.pendingApprovalReasons ?? [],
      });
      if (nowActive) await notifyAlertsIfActive(listing.status, listing.toObject());
    }

    return NextResponse.json(listing);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
