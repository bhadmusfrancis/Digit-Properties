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
    const images = Array.isArray(listing.images)
      ? listing.images.map((img: { url?: string; public_id?: string }) => ({
          url: img?.url ?? '',
          public_id: img?.public_id ?? '',
        })).filter((img: { url: string }) => img.url)
      : [];
    return NextResponse.json({
      ...listing,
      images,
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

    const normalizedImages =
      parsed.data.images !== undefined
        ? (Array.isArray(parsed.data.images) ? parsed.data.images : [])
            .map((img: { url?: string; public_id?: string }) => ({
              url: typeof img?.url === 'string' ? img.url.trim() : '',
              public_id: typeof img?.public_id === 'string' ? img.public_id.trim() : '',
            }))
            .filter((img) => img.url && img.public_id)
        : undefined;
    const normalizedVideos =
      parsed.data.videos !== undefined
        ? (Array.isArray(parsed.data.videos) ? parsed.data.videos : [])
            .map((v: { url?: string; public_id?: string }) => ({
              url: typeof v?.url === 'string' ? v.url.trim() : '',
              public_id: typeof v?.public_id === 'string' ? v.public_id.trim() : '',
            }))
            .filter((v) => v.url && v.public_id)
        : undefined;

    if (normalizedImages !== undefined || normalizedVideos !== undefined) {
      const user = await User.findById(session.user.id).lean();
      const tier =
        session.user.role === USER_ROLES.ADMIN
          ? SUBSCRIPTION_TIERS.PREMIUM
          : (user?.subscriptionTier as string) ||
            (session.user.role === USER_ROLES.GUEST ? SUBSCRIPTION_TIERS.GUEST : SUBSCRIPTION_TIERS.FREE);
      const limits = await getSubscriptionLimits(tier);
      const images = normalizedImages ?? (listing.images ?? []).map((img: { url?: string; public_id?: string }) => ({ url: img?.url ?? '', public_id: img?.public_id ?? '' }));
      const videos = normalizedVideos ?? (listing.videos ?? []).map((v: { url?: string; public_id?: string }) => ({ url: v?.url ?? '', public_id: v?.public_id ?? '' }));
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
      if (normalizedImages !== undefined) listing.images = images;
      if (normalizedVideos !== undefined) listing.videos = videos;
    }

    const wasDraft = listing.status === LISTING_STATUS.DRAFT;
    const { images: _pi, videos: _pv, ...rest } = parsed.data;
    Object.assign(listing, rest);
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
