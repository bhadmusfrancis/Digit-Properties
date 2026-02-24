import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import SubscriptionConfig from '@/models/SubscriptionConfig';
import { SUBSCRIPTION_TIERS, DEFAULT_SUBSCRIPTION_LIMITS } from '@/lib/constants';

export type PackageDisplay = {
  tier: string;
  label: string;
  priceMonthly: number;
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  maxFeatured: number;
  maxHighlighted: number;
  isGuestOrFree: boolean;
};

/** Public: returns listing packages for display (e.g. new listing page). Guest and free are merged as "Guest / Free". */
export async function GET() {
  try {
    await dbConnect();
    const configs = await SubscriptionConfig.find({}).sort({ tier: 1 }).lean();
    const tiers = [SUBSCRIPTION_TIERS.GUEST, SUBSCRIPTION_TIERS.GOLD, SUBSCRIPTION_TIERS.PREMIUM] as const;
    const result: PackageDisplay[] = tiers.map((tier) => {
      const found = configs.find((c) => c.tier === tier);
      const def = DEFAULT_SUBSCRIPTION_LIMITS[tier] ?? DEFAULT_SUBSCRIPTION_LIMITS.free;
      const isGuestOrFree = tier === SUBSCRIPTION_TIERS.GUEST;
      const maxListings = found?.maxListings ?? def.maxListings ?? 5;
      const maxImages = found?.maxImages ?? def.maxImages ?? 5;
      const maxVideos = found?.maxVideos ?? def.maxVideos ?? 1;
      const maxFeatured = found?.maxFeatured ?? def.maxFeatured ?? 0;
      const maxHighlighted = found?.maxHighlighted ?? def.maxHighlighted ?? 0;
      const priceMonthly = found?.priceMonthly ?? def.priceMonthly ?? 0;
      const label =
        tier === SUBSCRIPTION_TIERS.GUEST
          ? 'Guest / Free'
          : tier === SUBSCRIPTION_TIERS.GOLD
            ? 'Gold'
            : tier === SUBSCRIPTION_TIERS.PREMIUM
              ? 'Premium'
              : tier;
      return {
        tier,
        label,
        priceMonthly,
        maxListings,
        maxImages,
        maxVideos,
        maxFeatured,
        maxHighlighted,
        isGuestOrFree,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[packages]', e);
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 });
  }
}
