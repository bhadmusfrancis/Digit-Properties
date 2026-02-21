import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import ListingLike from '@/models/ListingLike';
import User from '@/models/User';
import { listingUpdateSchema } from '@/lib/validations';
import { LISTING_STATUS, USER_ROLES, SUBSCRIPTION_TIERS } from '@/lib/constants';
import { sendAdminNewListing } from '@/lib/email';
import { notifyMatchingAlerts } from '@/lib/alerts';
import { getSubscriptionLimits } from '@/lib/subscription-limits';
import mongoose from 'mongoose';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .populate('createdBy', 'name image role verifiedAt')
      .lean();

    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const likeCount = await ListingLike.countDocuments({ listingId: listing._id });
    return NextResponse.json({
      ...listing,
      likeCount,
      isBoosted: listing.boostExpiresAt && new Date(listing.boostExpiresAt) > new Date(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 });
  }
}

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

    await dbConnect();
    const listing = await Listing.findById(id);
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = session.user.role === USER_ROLES.ADMIN;
    const isOwner = listing.createdBy.toString() === session.user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = listingUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.images !== undefined || parsed.data.videos !== undefined) {
      const user = await User.findById(session.user.id).lean();
      const tier =
        session.user.role === USER_ROLES.ADMIN
          ? SUBSCRIPTION_TIERS.PREMIUM
          : (user?.subscriptionTier as string) ||
            (session.user.role === USER_ROLES.GUEST ? SUBSCRIPTION_TIERS.GUEST : SUBSCRIPTION_TIERS.FREE);
      const limits = await getSubscriptionLimits(tier);
      const images = Array.isArray(parsed.data.images) ? parsed.data.images : listing.images ?? [];
      const videos = Array.isArray(parsed.data.videos) ? parsed.data.videos : listing.videos ?? [];
      if (images.length > limits.maxImages) {
        return NextResponse.json(
          { error: `Maximum ${limits.maxImages} images per listing for your plan.` },
          { status: 400 }
        );
      }
      if (videos.length > limits.maxVideos) {
        return NextResponse.json(
          { error: `Maximum ${limits.maxVideos} video(s) per listing for your plan.` },
          { status: 400 }
        );
      }
    }

    const wasDraft = listing.status === LISTING_STATUS.DRAFT;
    Object.assign(listing, parsed.data);
    if (isAdmin && body.createdBy && mongoose.Types.ObjectId.isValid(body.createdBy)) {
      listing.createdBy = new mongoose.Types.ObjectId(body.createdBy);
    }
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
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}

export async function DELETE(
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

    await dbConnect();
    const listing = await Listing.findById(id);
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = session.user.role === USER_ROLES.ADMIN;
    const isOwner = listing.createdBy.toString() === session.user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await Listing.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }
}
