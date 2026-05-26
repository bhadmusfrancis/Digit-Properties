import { dbConnect } from '@/lib/db';
import SubscriptionConfig from '@/models/SubscriptionConfig';
import { DEFAULT_SUBSCRIPTION_LIMITS } from '@/lib/constants';
import {
  getFreeAccountListingLimits,
  getListingPackageDefaultLimits,
  resolveListingPackageTier,
  type ListingPackageTier,
} from '@/lib/listing-package-defaults';

export type SubscriptionLimits = {
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  maxCategories: number;
  maxFeatured: number;
  maxHighlighted: number;
  priceMonthly: number;
};

function defaultLimitsForTier(tier: string): SubscriptionLimits {
  const resolved = resolveListingPackageTier(tier);
  if (resolved === 'free') {
    return DEFAULT_SUBSCRIPTION_LIMITS.free ?? getFreeAccountListingLimits();
  }
  return (
    DEFAULT_SUBSCRIPTION_LIMITS[resolved] ??
    getListingPackageDefaultLimits(resolved as ListingPackageTier)
  );
}

export async function getSubscriptionLimits(tier: string): Promise<SubscriptionLimits> {
  const resolved = resolveListingPackageTier(tier);
  const configTier = resolved === 'free' ? 'free' : resolved;
  const defaults = defaultLimitsForTier(tier);
  try {
    await dbConnect();
    const config = await SubscriptionConfig.findOne({ tier: configTier }).lean();
    if (config) {
      return {
        maxListings: config.maxListings,
        maxImages: config.maxImages,
        maxVideos: config.maxVideos,
        canFeatured: config.canFeatured,
        canHighlighted: config.canHighlighted,
        maxCategories: config.maxCategories ?? (defaults.maxCategories ?? 1),
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
