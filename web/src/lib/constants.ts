/** Document type selected by user when uploading ID for verification. */
export const ID_TYPES = {
  DRIVERS_LICENSE: 'drivers_license',
  NATIONAL_ID: 'national_id',
  VOTERS_CARD: 'voters_card',
  INTERNATIONAL_PASSPORT: 'international_passport',
} as const;

export type IdType = (typeof ID_TYPES)[keyof typeof ID_TYPES];

export const USER_ROLES = {
  GUEST: 'guest',
  VERIFIED_INDIVIDUAL: 'verified_individual',
  REGISTERED_AGENT: 'registered_agent',
  REGISTERED_DEVELOPER: 'registered_developer',
  ADMIN: 'admin',
  /** Bot account: only role that can use Import from WhatsApp; only their listings can be claimed. */
  BOT: 'bot',
} as const;

export const LISTING_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  CLOSED: 'closed',
  /** Set when owner edits an active listing; requires admin approval to go back to active. */
  PENDING_APPROVAL: 'pending_approval',
} as const;

export const LISTING_TYPE = {
  SALE: 'sale',
  RENT: 'rent',
  /** Land JV / partnership (premium + sharing terms; common in Lagos group listings) */
  JOINT_VENTURE: 'joint_venture',
} as const;

export type ListingType = (typeof LISTING_TYPE)[keyof typeof LISTING_TYPE];

/** Rent period: price is per day, month, or year (for rent listings only) */
export const RENT_PERIOD = {
  DAY: 'day',
  MONTH: 'month',
  YEAR: 'year',
} as const;

/**
 * Property categories for filters, schema, and imports.
 * Covers typical Nigerian market listings (residential, commercial, industrial, JV land).
 */
export const PROPERTY_TYPES = [
  'apartment',
  'bungalow',
  'commercial',
  'duplex',
  'event_center',
  'factory',
  'farm',
  'hotel',
  'house',
  'industrial',
  'land',
  'maisonette',
  'mini_flat',
  'mixed_use',
  'office',
  'penthouse',
  'semi_detached',
  'shop',
  'studio',
  'terrace',
  'townhouse',
  'villa',
  'warehouse',
] as const;

/** Readable label for URL/slug property types (e.g. event_center → Event center). */
export function formatPropertyTypeLabel(slug: string): string {
  if (!slug) return '';
  return slug
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

/** Join multiple property slugs for display (e.g. cards + detail). */
export function formatPropertyTypesLine(slugs: string[] | undefined | null, fallbackSlug?: string): string {
  const list = slugs?.filter(Boolean) ?? [];
  if (!list.length) return fallbackSlug ? formatPropertyTypeLabel(fallbackSlug) : '';
  return list.map((s) => formatPropertyTypeLabel(s)).join(' · ');
}

/** Readable label for listing type (sale / rent / joint venture). */
export function formatListingTypeLabel(t: string): string {
  if (t === LISTING_TYPE.JOINT_VENTURE) return 'Joint venture';
  if (t === LISTING_TYPE.RENT) return 'Rent';
  if (t === LISTING_TYPE.SALE) return 'Sale';
  return formatPropertyTypeLabel(t);
}

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const;

/** Popular amenities shown as quick-select on listing form (web + mobile). */
export const POPULAR_AMENITIES = [
  'Parking',
  'Security',
  '24hr Power',
  'Generator',
  'Pool',
  'Gym',
  'Fitted Kitchen',
  'BQ',
  'Garden',
  'Water Supply',
  'Elevator',
  'AC',
  'WiFi',
  'CCTV',
  'Serviced',
] as const;

export const CLAIM_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const PAYMENT_PURPOSE = {
  BOOST_LISTING: 'boost_listing',
  BANNER_AD: 'banner_ad',
  SUBSCRIPTION_TIER: 'subscription_tier',
  USER_AD: 'user_ad',
} as const;

/** Ad placement slots (homescreen, search, listings). */
export const AD_PLACEMENTS = ['home_featured', 'search', 'listings'] as const;

/** User ad lifecycle status. */
export const USER_AD_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ACTIVE: 'active',
  EXPIRED: 'expired',
} as const;

/** Recommended ad image size for SEO/social (og:image). */
export const AD_MEDIA_RECOMMENDED = { width: 1200, height: 630 };

/** Subscription tiers for listing/media limits. Guest = unauthenticated-style limits. */
export const SUBSCRIPTION_TIERS = {
  GUEST: 'guest',
  FREE: 'free',
  GOLD: 'gold',
  PREMIUM: 'premium',
} as const;

/** Trend post categories (Nigeria-focused). */
export const TREND_CATEGORIES = [
  'Market Trends',
  'Policy & Regulation',
  'Lagos Focus',
  'Abuja & FCT',
  'Port Harcourt & Niger Delta',
  'Events & Exhibitions',
  'Industry Reports',
  'Investment & Finance',
  'Housing & Affordability',
  'Land & Titling',
] as const;

export const TREND_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

/** Default limits per tier when no admin config exists. */
export const DEFAULT_SUBSCRIPTION_LIMITS: Record<string, {
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  maxCategories: number;
  maxFeatured: number;
  maxHighlighted: number;
  priceMonthly: number;
}> = {
  guest: { maxListings: 99999, maxImages: 10, maxVideos: 1, canFeatured: false, canHighlighted: false, maxCategories: 1, maxFeatured: 0, maxHighlighted: 0, priceMonthly: 0 },
  free: { maxListings: 99999, maxImages: 10, maxVideos: 1, canFeatured: false, canHighlighted: false, maxCategories: 1, maxFeatured: 0, maxHighlighted: 0, priceMonthly: 0 },
  bot: { maxListings: 99999, maxImages: 15, maxVideos: 3, canFeatured: false, canHighlighted: false, maxCategories: 1, maxFeatured: 0, maxHighlighted: 0, priceMonthly: 0 },
  gold: { maxListings: 99999, maxImages: 15, maxVideos: 3, canFeatured: true, canHighlighted: true, maxCategories: 3, maxFeatured: 5, maxHighlighted: 5, priceMonthly: 10000 },
  premium: { maxListings: 99999, maxImages: 25, maxVideos: 5, canFeatured: true, canHighlighted: true, maxCategories: 5, maxFeatured: 15, maxHighlighted: 15, priceMonthly: 30000 },
};
