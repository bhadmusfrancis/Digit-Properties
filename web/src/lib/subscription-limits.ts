import { dbConnect } from '@/lib/db';
import SubscriptionConfig from '@/models/SubscriptionConfig';
import { DEFAULT_SUBSCRIPTION_LIMITS } from '@/lib/constants';

export type SubscriptionLimits = {
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
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
      };
    }
  } catch (e) {
    console.error('[subscription-limits]', e);
  }
  return defaults;
}
