import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import Claim from '@/models/Claim';
import User from '@/models/User';
import { USER_ROLES, SUBSCRIPTION_TIERS } from '@/lib/constants';
import { getSubscriptionLimits } from '@/lib/subscription-limits';
import { applyBoostToLimits } from '@/lib/listing-effective-limits';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    const userId = new mongoose.Types.ObjectId(session.user.id);
    const user = await User.findById(userId).select('subscriptionTier').lean();
    const tier =
      session.user.role === USER_ROLES.ADMIN
        ? SUBSCRIPTION_TIERS.PREMIUM
        : (user?.subscriptionTier as string) ||
          (session.user.role === USER_ROLES.GUEST ? SUBSCRIPTION_TIERS.GUEST : SUBSCRIPTION_TIERS.FREE);
    const baseLimits = await getSubscriptionLimits(tier);

    const url = new URL(req.url);
    const listingId = url.searchParams.get('listingId');
    let listingBoost: { boostPackage?: string | null; boostExpiresAt?: Date | null } | null = null;
    if (listingId && mongoose.Types.ObjectId.isValid(listingId)) {
      const listing = await Listing.findOne({ _id: listingId, createdBy: userId })
        .select('boostPackage boostExpiresAt')
        .lean();
      if (listing) {
        listingBoost = {
          boostPackage: listing.boostPackage ?? null,
          boostExpiresAt: listing.boostExpiresAt ?? null,
        };
      }
    }

    const limits = applyBoostToLimits(baseLimits, listingBoost);

    const [listingsCount, claimsCount, featuredCount, highlightedCount] = await Promise.all([
      Listing.countDocuments({ createdBy: userId }),
      Claim.countDocuments({ userId, status: 'pending' }),
      Listing.countDocuments({ createdBy: userId, featured: true }),
      Listing.countDocuments({ createdBy: userId, highlighted: true }),
    ]);
    return NextResponse.json({
      listingsCount,
      claimsCount,
      maxListings: limits.maxListings,
      maxImages: limits.maxImages,
      maxVideos: limits.maxVideos,
      maxCategories: limits.maxCategories,
      tier,
      featuredCount,
      highlightedCount,
      maxFeatured: limits.maxFeatured,
      maxHighlighted: limits.maxHighlighted,
      canFeatured: limits.canFeatured,
      canHighlighted: limits.canHighlighted,
      boostActive: limits.boostActive,
      boostPackage: limits.boostPackage,
      boostExpiresAt: limits.boostExpiresAt,
      // Base (non-boosted) caps so the client can show how much extra a boost unlocks.
      baseMaxImages: baseLimits.maxImages,
      baseMaxVideos: baseLimits.maxVideos,
      baseMaxCategories: baseLimits.maxCategories,
      baseCanFeatured: baseLimits.canFeatured,
      baseCanHighlighted: baseLimits.canHighlighted,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
