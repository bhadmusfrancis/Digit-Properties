import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import SubscriptionConfig from '@/models/SubscriptionConfig';
import { USER_ROLES } from '@/lib/constants';
import { SUBSCRIPTION_TIERS } from '@/lib/constants';
import { DEFAULT_SUBSCRIPTION_LIMITS } from '@/lib/constants';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await dbConnect();
    const configs = await SubscriptionConfig.find({}).sort({ tier: 1 }).lean();
    const tiers = Object.values(SUBSCRIPTION_TIERS);
    const result = tiers.map((tier) => {
      const found = configs.find((c) => c.tier === tier);
      const def = DEFAULT_SUBSCRIPTION_LIMITS[tier];
      return {
        tier,
        maxListings: found?.maxListings ?? def?.maxListings ?? 5,
        maxImages: found?.maxImages ?? def?.maxImages ?? 5,
        maxVideos: found?.maxVideos ?? def?.maxVideos ?? 1,
        canFeatured: found?.canFeatured ?? def?.canFeatured ?? false,
        canHighlighted: found?.canHighlighted ?? def?.canHighlighted ?? false,
        maxFeatured: found?.maxFeatured ?? def?.maxFeatured ?? 0,
        maxHighlighted: found?.maxHighlighted ?? def?.maxHighlighted ?? 0,
        priceMonthly: found?.priceMonthly ?? def?.priceMonthly ?? 0,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const { tier, maxListings, maxImages, maxVideos, canFeatured, canHighlighted, maxFeatured, maxHighlighted, priceMonthly } = body;
    if (!tier || !Object.values(SUBSCRIPTION_TIERS).includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }
    await dbConnect();
    const def = DEFAULT_SUBSCRIPTION_LIMITS[tier];
    await SubscriptionConfig.findOneAndUpdate(
      { tier },
      {
        maxListings: Number(maxListings) ?? def?.maxListings ?? 5,
        maxImages: Number(maxImages) ?? def?.maxImages ?? 5,
        maxVideos: Number(maxVideos) ?? def?.maxVideos ?? 1,
        canFeatured: Boolean(canFeatured),
        canHighlighted: Boolean(canHighlighted),
        maxFeatured: Number(maxFeatured) >= 0 ? Number(maxFeatured) : (def?.maxFeatured ?? 0),
        maxHighlighted: Number(maxHighlighted) >= 0 ? Number(maxHighlighted) : (def?.maxHighlighted ?? 0),
        priceMonthly: Number(priceMonthly) >= 0 ? Number(priceMonthly) : (def?.priceMonthly ?? 0),
      },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
