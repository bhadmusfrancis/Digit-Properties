import { dbConnect } from '@/lib/db';
import SubscriptionConfig from '@/models/SubscriptionConfig';
import { DEFAULT_SUBSCRIPTION_LIMITS } from '@/lib/constants';

export type SubscriptionLimits = {
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  maxFeatured: number;
  maxHighlighted: number;
  priceMonthly: number;
};

export async function getSubscriptionLimits(tier: string): Promise<SubscriptionLimits> {
  const defaults = DEFAULT_SUBSCRIPTION_LIMITS[tier] ?? DEFAULT_SUBSCRIPTION_LIMITS.free;
  try {
    await dbConnect();
    const config = await SubscriptionConfig.findOne({ tier }).lean();
    if (config) {
      return {
        maxListings: config.maxListings,
        maxImages: config.maxImages,
        maxVideos: config.maxVideos,
        canFeatured: config.canFeatured,
        canHighlighted: config.canHighlighted,
        maxFeatured: config.maxFeatured ?? (config.canFeatured ? 5 : 0),
        maxHighlighted: config.maxHighlighted ?? (config.canHighlighted ? 5 : 0),
        priceMonthly: config.priceMonthly ?? 0,
      };
    }
  } catch (e) {
    console.error('[subscription-limits]', e);
  }
  return defaults;
}
