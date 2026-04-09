import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import ListingLike from '@/models/ListingLike';
import User from '@/models/User';
import { listingUpdateSchema } from '@/lib/validations';
import { LISTING_STATUS, USER_ROLES, SUBSCRIPTION_TIERS, POPULAR_AMENITIES } from '@/lib/constants';
import { sendAdminNewListing } from '@/lib/email';
import { notifyMatchingAlerts } from '@/lib/alerts';
import { getSubscriptionLimits } from '@/lib/subscription-limits';
import { extractAmenitiesFromText, mergeUniqueLists, normalizeList } from '@/lib/listing-amenities';
import { dedupeImagesByPublicId, findUserListingDuplicate } from '@/lib/listing-dedupe';
import { canViewListingOnSite } from '@/lib/listing-access';
import { shapePublicCreatedBy, USER_PUBLIC_BADGE_FIELDS } from '@/lib/verification';
import mongoose from 'mongoose';
import { BOOST_PACKAGES } from '@/lib/boost-packages';
import { getListingModerationConfig } from '@/lib/listing-moderation-config';

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
    const session = await getSession(_req);
    const pre = await Listing.findById(id)
      .select('status createdBy')
      .lean();
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
      .populate('createdBy', USER_PUBLIC_BADGE_FIELDS)
      .lean();

    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const likeCount = await ListingLike.countDocuments({ listingId: listing._id });
    const images = Array.isArray(listing.images)
      ? listing.images.map((img: { url?: string; public_id?: string }) => ({
          url: img?.url ?? '',
          public_id: img?.public_id ?? '',
        })).filter((img: { url: string }) => img.url)
      : [];
    const { createdBy, ...listingRest } = listing as typeof listing & { createdBy?: unknown };
    return NextResponse.json({
      ...listingRest,
      createdBy: shapePublicCreatedBy(createdBy) ?? createdBy,
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

    // Non-admins should only be able to keep listings as draft/active via this endpoint.
    // Anything else (paused/closed/pending_approval) should be controlled by the admin flow.
    const requestedStatus = parsed.data.status;
    if (
      !isAdmin &&
      typeof requestedStatus === 'string' &&
      requestedStatus !== LISTING_STATUS.DRAFT &&
      requestedStatus !== LISTING_STATUS.ACTIVE
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
          { error: `You can add up to ${limits.maxImages} images per listing.` },
          { status: 400 }
        );
      }
      if (videos.length > limits.maxVideos) {
        return NextResponse.json(
          { error: `You can add up to ${limits.maxVideos} video(s) per listing.` },
          { status: 400 }
        );
      }
      if (normalizedImages !== undefined) listing.images = dedupeImagesByPublicId(images);
      if (normalizedVideos !== undefined) listing.videos = dedupeImagesByPublicId(videos);
    }

    if (parsed.data.featured === true || parsed.data.highlighted === true) {
      const user = await User.findById(session.user.role === USER_ROLES.ADMIN ? listing.createdBy : session.user.id).lean();
      const tier =
        session.user.role === USER_ROLES.ADMIN
          ? SUBSCRIPTION_TIERS.PREMIUM
          : (user?.subscriptionTier as string) ||
            (session.user.role === USER_ROLES.GUEST ? SUBSCRIPTION_TIERS.GUEST : SUBSCRIPTION_TIERS.FREE);
      const limits = await getSubscriptionLimits(tier);
      const ownerId = listing.createdBy;
      if (parsed.data.featured === true && !listing.featured) {
        if (!limits.canFeatured || limits.maxFeatured <= 0) {
          return NextResponse.json({ error: 'Featured listings not available on your plan. Upgrade to Gold or Premium.' }, { status: 400 });
        }
        const featuredCount = await Listing.countDocuments({ createdBy: ownerId, featured: true });
        if (featuredCount >= limits.maxFeatured) {
          return NextResponse.json({ error: `You can have maximum ${limits.maxFeatured} Featured listing(s). Upgrade for more.` }, { status: 400 });
        }
      }
      if (parsed.data.highlighted === true && !listing.highlighted) {
        if (!limits.canHighlighted || limits.maxHighlighted <= 0) {
          return NextResponse.json({ error: 'Highlighted listings not available on your plan. Upgrade to Gold or Premium.' }, { status: 400 });
        }
        const highlightedCount = await Listing.countDocuments({ createdBy: ownerId, highlighted: true });
        if (highlightedCount >= limits.maxHighlighted) {
          return NextResponse.json({ error: `You can have maximum of ${limits.maxHighlighted} Highlighted listing(s). Upgrade for more.` }, { status: 400 });
        }
      }
    }

    const wasDraft = listing.status === LISTING_STATUS.DRAFT;
    const wasActive = listing.status === LISTING_STATUS.ACTIVE;
    const wasPendingApproval = listing.status === LISTING_STATUS.PENDING_APPROVAL;
    const incomingAmenities =
      parsed.data.amenities !== undefined ? normalizeList(parsed.data.amenities) : undefined;
    const incomingTags =
      parsed.data.tags !== undefined ? normalizeList(parsed.data.tags) : undefined;
    const {
      images: _pi,
      videos: _pv,
      amenities: _pa,
      tags: _pt,
      propertyTypes: patchPropertyTypes,
      propertyType: patchPropertyType,
      ...rest
    } = parsed.data;
    Object.assign(listing, rest);
    if (patchPropertyTypes !== undefined) {
      listing.propertyTypes = patchPropertyTypes as typeof listing.propertyTypes;
      if (patchPropertyTypes.length > 0) {
        listing.propertyType = patchPropertyTypes[0] as typeof listing.propertyType;
      }
    } else if (patchPropertyType !== undefined) {
      listing.propertyType = patchPropertyType as typeof listing.propertyType;
      listing.propertyTypes = [patchPropertyType] as typeof listing.propertyTypes;
    }
    const textForAmenityDetect = `${listing.title ?? ''}\n${listing.description ?? ''}\n${(incomingTags ?? listing.tags ?? []).join(', ')}`;
    const detectedAmenities = extractAmenitiesFromText(textForAmenityDetect, POPULAR_AMENITIES);
    if (incomingAmenities !== undefined || detectedAmenities.length > 0) {
      listing.amenities = mergeUniqueLists(listing.amenities, incomingAmenities, detectedAmenities);
    }
    if (incomingTags !== undefined || incomingAmenities !== undefined) {
      listing.tags = mergeUniqueLists(
        listing.tags,
        incomingTags,
        incomingAmenities ?? listing.amenities
      );
    }
    if (isAdmin && body.createdBy && mongoose.Types.ObjectId.isValid(body.createdBy)) {
      listing.createdBy = new mongoose.Types.ObjectId(body.createdBy);
    }
    if (isAdmin) {
      if (typeof body.boostPackage === 'string' && body.boostPackage.trim()) {
        const key = body.boostPackage.trim().toLowerCase() as keyof typeof BOOST_PACKAGES;
        const selected = BOOST_PACKAGES[key];
        if (!selected) {
          return NextResponse.json({ error: 'Invalid boost package' }, { status: 400 });
        }
        const now = new Date();
        const currentEnd = listing.boostExpiresAt ? new Date(listing.boostExpiresAt) : null;
        const base = currentEnd && currentEnd > now ? currentEnd : now;
        const newExpiry = new Date(base);
        newExpiry.setDate(newExpiry.getDate() + selected.days);
        listing.boostPackage = key;
        listing.boostExpiresAt = newExpiry;
        listing.featured = selected.featured;
        listing.highlighted = selected.highlighted;
      } else if (body.boostPackage === null || body.boostPackage === '') {
        listing.boostPackage = undefined;
        listing.boostExpiresAt = undefined;
        listing.featured = false;
        listing.highlighted = false;
      }
    }
    // Enforce contact source choice when switching to listing contact
    if ((parsed.data as { contactSource?: string }).contactSource === 'listing') {
      const nextName =
        (parsed.data as { agentName?: string }).agentName ?? listing.agentName ?? '';
      const nextPhone =
        (parsed.data as { agentPhone?: string }).agentPhone ?? listing.agentPhone ?? '';
      const nextEmail =
        (parsed.data as { agentEmail?: string }).agentEmail ?? listing.agentEmail ?? '';
      if (!String(nextName).trim() && !String(nextPhone).trim() && !String(nextEmail).trim()) {
        return NextResponse.json(
          {
            error: 'Add listing contact details (phone/email/name) or switch contact to Author contact.',
            code: 'CONTACT_REQUIRED',
          },
          { status: 400 }
        );
      }
    }
    const mod = await getListingModerationConfig();
    if (!isAdmin && wasActive && mod.editedListingsRequireApproval) {
      listing.status = LISTING_STATUS.PENDING_APPROVAL;
    }
    if (
      !isAdmin &&
      session.user.role !== USER_ROLES.BOT &&
      wasDraft &&
      listing.status === LISTING_STATUS.ACTIVE &&
      mod.newListingsRequireApproval
    ) {
      listing.status = LISTING_STATUS.PENDING_APPROVAL;
    }

    const mediaIds = [
      ...(listing.images || []).map((i: { public_id?: string }) => (i.public_id || '').trim()).filter(Boolean),
      ...(listing.videos || []).map((v: { public_id?: string }) => (v.public_id || '').trim()).filter(Boolean),
    ];
    const duplicateCheck = await findUserListingDuplicate(
      listing.createdBy.toString(),
      {
        title: listing.title,
        description: listing.description,
        mediaPublicIds: mediaIds,
      },
      String(listing._id)
    );
    if (duplicateCheck) {
      return NextResponse.json(
        { error: duplicateCheck.message, code: duplicateCheck.code },
        { status: 409 }
      );
    }

    await listing.save();

    const nowActive = listing.status === LISTING_STATUS.ACTIVE;
    const nowPending = listing.status === LISTING_STATUS.PENDING_APPROVAL;
    const userRequestedActiveFromDraft = wasDraft && parsed.data.status === LISTING_STATUS.ACTIVE;

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
    } else if (wasPendingApproval && nowActive) {
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
