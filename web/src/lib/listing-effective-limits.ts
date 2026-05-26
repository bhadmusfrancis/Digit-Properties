import { BOOST_PACKAGES, type BoostPackage } from '@/lib/boost-packages';
import { BOOST_MEDIA_CAPS } from '@/lib/listing-package-defaults';
import { getSubscriptionLimits, type SubscriptionLimits } from '@/lib/subscription-limits';

export type ListingBoostState = {
  boostPackage?: BoostPackage['id'] | string | null;
  boostExpiresAt?: Date | string | null;
};

export type EffectiveListingLimits = SubscriptionLimits & {
  /** True if the listing currently has an active boost contributing to the cap. */
  boostActive: boolean;
  boostPackage?: BoostPackage['id'];
  boostExpiresAt?: Date;
};

/** Whether a boost is set and not yet expired. */
export function isBoostActive(state: ListingBoostState | null | undefined): boolean {
  if (!state?.boostPackage) return false;
  const expires = state.boostExpiresAt ? new Date(state.boostExpiresAt) : null;
  if (!expires) return false;
  return expires.getTime() > Date.now();
}

/** Get the boost package definition if the listing has an active boost. */
export function getActiveBoostPackage(state: ListingBoostState | null | undefined): BoostPackage | null {
  if (!isBoostActive(state)) return null;
  const id = String(state?.boostPackage) as BoostPackage['id'];
  return BOOST_PACKAGES[id] ?? null;
}

/**
 * Combine subscription tier limits with any active per-listing boost.
 * The boost only ever raises caps — never lowers them.
 */
export async function getEffectiveListingLimits(
  tier: string,
  listing: ListingBoostState | null | undefined
): Promise<EffectiveListingLimits> {
  const base = await getSubscriptionLimits(tier);
  const boost = getActiveBoostPackage(listing);
  if (!boost) {
    return { ...base, boostActive: false };
  }
  const caps = BOOST_MEDIA_CAPS[boost.id];
  return {
    ...base,
    maxImages: Math.max(base.maxImages, caps.maxImages),
    maxVideos: Math.max(base.maxVideos, caps.maxVideos),
    maxCategories: Math.max(base.maxCategories ?? 1, caps.maxCategories),
    canFeatured: base.canFeatured || boost.featured,
    canHighlighted: base.canHighlighted || boost.highlighted,
    maxFeatured: Math.max(base.maxFeatured, boost.featured ? 1 : 0),
    maxHighlighted: Math.max(base.maxHighlighted, boost.highlighted ? 1 : 0),
    boostActive: true,
    boostPackage: boost.id,
    boostExpiresAt: listing?.boostExpiresAt ? new Date(listing.boostExpiresAt) : undefined,
  };
}

/**
 * Synchronous version that accepts pre-fetched subscription limits — useful
 * inside hot paths that already have them.
 */
export function applyBoostToLimits(
  base: SubscriptionLimits,
  listing: ListingBoostState | null | undefined
): EffectiveListingLimits {
  const boost = getActiveBoostPackage(listing);
  if (!boost) return { ...base, boostActive: false };
  const caps = BOOST_MEDIA_CAPS[boost.id];
  return {
    ...base,
    maxImages: Math.max(base.maxImages, caps.maxImages),
    maxVideos: Math.max(base.maxVideos, caps.maxVideos),
    maxCategories: Math.max(base.maxCategories ?? 1, caps.maxCategories),
    canFeatured: base.canFeatured || boost.featured,
    canHighlighted: base.canHighlighted || boost.highlighted,
    maxFeatured: Math.max(base.maxFeatured, boost.featured ? 1 : 0),
    maxHighlighted: Math.max(base.maxHighlighted, boost.highlighted ? 1 : 0),
    boostActive: true,
    boostPackage: boost.id,
    boostExpiresAt: listing?.boostExpiresAt ? new Date(listing.boostExpiresAt) : undefined,
  };
}
