import { AD_PLACEMENTS } from '@/lib/constants';

/** Legacy placement key; merged into `search` (Listing Search Page). */
export const AD_PLACEMENT_LEGACY_LISTINGS = 'listings';

export const AD_PLACEMENT_LABELS: Record<
  (typeof AD_PLACEMENTS)[number] | typeof AD_PLACEMENT_LEGACY_LISTINGS,
  string
> = {
  home_featured: 'Homepage featured',
  search: 'Listing Search Page',
  listing_detail: 'Listing detail page',
  listings: 'Listing Search Page',
};

export function normalizeAdPlacement(placement: string): string {
  return placement === AD_PLACEMENT_LEGACY_LISTINGS ? 'search' : placement;
}

export function isValidAdPlacement(placement: string): boolean {
  return (AD_PLACEMENTS as readonly string[]).includes(normalizeAdPlacement(placement));
}

export function userAdPlacementsForSlot(placement: string): string | { $in: string[] } {
  const normalized = normalizeAdPlacement(placement);
  if (normalized === 'search') {
    return { $in: ['search', AD_PLACEMENT_LEGACY_LISTINGS] };
  }
  return normalized;
}

export function placementConfigValue(
  record: Record<string, string | undefined> | undefined,
  placement: string,
): string | undefined {
  if (!record) return undefined;
  const normalized = normalizeAdPlacement(placement);
  const direct = record[normalized]?.trim();
  if (direct) return direct;
  if (normalized === 'search') {
    const legacy = record[AD_PLACEMENT_LEGACY_LISTINGS]?.trim();
    if (legacy) return legacy;
  }
  return undefined;
}

type Pricing = { pricePerDay: number; pricePerHour: number; currency: string };

export function placementPricingValue<T>(
  record: Record<string, T | undefined> | undefined,
  placement: string,
): T | undefined {
  if (!record) return undefined;
  const normalized = normalizeAdPlacement(placement);
  const direct = record[normalized];
  if (direct) return direct;
  if (normalized === 'search') return record[AD_PLACEMENT_LEGACY_LISTINGS];
  return undefined;
}

export function normalizeAdConfigForClient(config: {
  placementPricing?: Record<string, Pricing>;
  adsense?: Record<string, string>;
  adsterra?: Record<string, string>;
  [key: string]: unknown;
}) {
  const mergeRecord = <R extends Record<string, unknown>>(record: R | undefined): R => {
    const out: Record<string, unknown> = { ...(record ?? {}) };
    if (!out.search && out[AD_PLACEMENT_LEGACY_LISTINGS]) {
      out.search = out[AD_PLACEMENT_LEGACY_LISTINGS];
    }
    delete out[AD_PLACEMENT_LEGACY_LISTINGS];
    return out as R;
  };

  return {
    ...config,
    placementPricing: mergeRecord(config.placementPricing),
    adsense: mergeRecord(config.adsense),
    adsterra: mergeRecord(config.adsterra),
  };
}

/** UserAd schema enum: current placements plus legacy listings. */
export const USER_AD_PLACEMENTS = [...AD_PLACEMENTS, AD_PLACEMENT_LEGACY_LISTINGS] as const;

export type AdPlacement = (typeof USER_AD_PLACEMENTS)[number];

export function getAdPlacementLabel(placement: string): string {
  return AD_PLACEMENT_LABELS[placement as AdPlacement] ?? placement;
}
