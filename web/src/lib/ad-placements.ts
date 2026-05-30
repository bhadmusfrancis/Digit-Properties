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

export function normalizeAdConfigForClient<T extends {
  placementPricing?: Record<string, Pricing>;
  adsense?: Record<string, string>;
  adsterra?: Record<string, string>;
}>(config: T): T {
  const out = { ...config };
  for (const key of ['placementPricing', 'adsense', 'adsterra'] as const) {
    const record = { ...(out[key] ?? {}) } as Record<string, unknown>;
    const search = record.search;
    const legacy = record[AD_PLACEMENT_LEGACY_LISTINGS];
    if (!search && legacy) record.search = legacy;
    delete record[AD_PLACEMENT_LEGACY_LISTINGS];
    out[key] = record as T[typeof key];
  }
  return out;
}

/** UserAd schema enum: current placements plus legacy listings. */
export const USER_AD_PLACEMENTS = [...AD_PLACEMENTS, AD_PLACEMENT_LEGACY_LISTINGS] as const;

export type AdPlacement = (typeof USER_AD_PLACEMENTS)[number];
