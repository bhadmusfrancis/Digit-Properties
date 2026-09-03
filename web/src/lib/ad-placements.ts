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

export type AdPricingMode = 'hourly' | 'daily' | 'weekly' | 'monthly';

export type PlacementPricingRates = {
  pricePerDay: number;
  pricePerHour: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  currency: string;
};

type Pricing = PlacementPricingRates;

const HOUR_MS = 60 * 60 * 1000;

export function resolvePlacementRates(pricing: PlacementPricingRates): {
  pricePerDay: number;
  pricePerHour: number;
  pricePerWeek: number;
  pricePerMonth: number;
  currency: string;
} {
  const day = Number(pricing.pricePerDay) || 0;
  return {
    pricePerDay: day,
    pricePerHour: Number(pricing.pricePerHour) || 0,
    pricePerWeek: pricing.pricePerWeek && pricing.pricePerWeek > 0 ? pricing.pricePerWeek : day * 7,
    pricePerMonth: pricing.pricePerMonth && pricing.pricePerMonth > 0 ? pricing.pricePerMonth : day * 30,
    currency: pricing.currency || 'NGN',
  };
}

export function parseAdPricingMode(value: unknown, useHourlyPricing?: boolean): AdPricingMode {
  if (value === 'hourly' || value === 'daily' || value === 'weekly' || value === 'monthly') return value;
  return useHourlyPricing ? 'hourly' : 'daily';
}

export function adDurationMs(mode: AdPricingMode, units: number): number {
  const n = Math.max(1, Math.ceil(units));
  if (mode === 'hourly') return n * HOUR_MS;
  if (mode === 'weekly') return n * 7 * 24 * HOUR_MS;
  if (mode === 'monthly') return n * 30 * 24 * HOUR_MS;
  return n * 24 * HOUR_MS;
}

export function computeAdAmount(
  pricing: PlacementPricingRates,
  mode: AdPricingMode,
  start: Date,
  end: Date
): number {
  const rates = resolvePlacementRates(pricing);
  const ms = Math.max(0, end.getTime() - start.getTime());
  const hours = ms / HOUR_MS;
  const days = ms / (24 * HOUR_MS);
  const weeks = ms / (7 * 24 * HOUR_MS);
  const months = ms / (30 * 24 * HOUR_MS);
  if (mode === 'hourly') return Math.ceil(hours) * rates.pricePerHour;
  if (mode === 'weekly') return Math.ceil(weeks) * rates.pricePerWeek;
  if (mode === 'monthly') return Math.ceil(months) * rates.pricePerMonth;
  return Math.ceil(days) * rates.pricePerDay;
}

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

  const rawPricing = mergeRecord(config.placementPricing);
  const placementPricing: Record<string, ReturnType<typeof resolvePlacementRates>> = {};
  for (const key of Object.keys(rawPricing)) {
    const value = rawPricing[key];
    if (value && typeof value === 'object') {
      placementPricing[key] = resolvePlacementRates(value as PlacementPricingRates);
    }
  }
  for (const p of AD_PLACEMENTS) {
    if (!placementPricing[p]) {
      placementPricing[p] = resolvePlacementRates({
        pricePerDay: 5000,
        pricePerHour: 500,
        pricePerWeek: 30000,
        pricePerMonth: 100000,
        currency: 'NGN',
      });
    }
  }

  return {
    ...config,
    placementPricing,
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
