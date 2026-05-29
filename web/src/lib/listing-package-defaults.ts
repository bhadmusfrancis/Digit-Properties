import { BOOST_PACKAGES, type BoostPackage } from '@/lib/boost-packages';

export type ListingPackageLimits = {
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  maxCategories: number;
  priceMonthly: number;
};

/** Boost package tiers editable in Admin → Config and shown on listing plans. */
export const LISTING_PACKAGE_TIERS = ['starter', 'pro', 'premium'] as const;
export type ListingPackageTier = (typeof LISTING_PACKAGE_TIERS)[number];

export function isListingPackageTier(tier: string): tier is ListingPackageTier {
  return LISTING_PACKAGE_TIERS.includes(tier as ListingPackageTier);
}

export const BOOST_MEDIA_CAPS: Record<
  BoostPackage['id'],
  { maxImages: number; maxVideos: number; maxCategories: number }
> = {
  starter: { maxImages: 10, maxVideos: 1, maxCategories: 2 },
  pro: { maxImages: 15, maxVideos: 3, maxCategories: 3 },
  premium: { maxImages: 25, maxVideos: 5, maxCategories: 5 },
};

/** Map legacy subscription tier keys to a listing package tier. */
export function resolveListingPackageTier(tier: string): ListingPackageTier | 'free' {
  const t = tier.trim().toLowerCase();
  if (t === 'free' || t === 'bot') return 'free';
  if (t === 'guest') return 'starter';
  if (t === 'gold') return 'pro';
  if (LISTING_PACKAGE_TIERS.includes(t as ListingPackageTier)) return t as ListingPackageTier;
  return 'free';
}

export function getListingPackageTierLabel(tier: ListingPackageTier): string {
  return BOOST_PACKAGES[tier].name;
}

/** Default limits for admin config / public packages, derived from boost package definitions. */
export function getListingPackageDefaultLimits(tier: ListingPackageTier): ListingPackageLimits {
  const pkg = BOOST_PACKAGES[tier];
  const caps = BOOST_MEDIA_CAPS[tier];
  return {
    maxListings: 99999,
    maxImages: caps.maxImages,
    maxVideos: caps.maxVideos,
    maxCategories: caps.maxCategories,
    canFeatured: pkg.featured,
    canHighlighted: pkg.highlighted,
    priceMonthly: pkg.amount,
  };
}

/** Account-level baseline when the user has not purchased a listing package tier. */
export function getFreeAccountListingLimits(): ListingPackageLimits {
  const starter = getListingPackageDefaultLimits('starter');
  return {
    ...starter,
    maxCategories: 1,
    canFeatured: false,
    canHighlighted: false,
    priceMonthly: 0,
  };
}
