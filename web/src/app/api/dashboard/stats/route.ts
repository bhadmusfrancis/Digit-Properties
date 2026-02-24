import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import Claim from '@/models/Claim';
import User from '@/models/User';
import { USER_ROLES, SUBSCRIPTION_TIERS } from '@/lib/constants';
import { getSubscriptionLimits } from '@/lib/subscription-limits';

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
    const limits = await getSubscriptionLimits(tier);

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
      tier,
      featuredCount,
      highlightedCount,
      maxFeatured: limits.maxFeatured,
      maxHighlighted: limits.maxHighlighted,
      canFeatured: limits.canFeatured,
      canHighlighted: limits.canHighlighted,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
