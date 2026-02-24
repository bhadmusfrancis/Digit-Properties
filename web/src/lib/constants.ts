export const USER_ROLES = {
  GUEST: 'guest',
  VERIFIED_INDIVIDUAL: 'verified_individual',
  REGISTERED_AGENT: 'registered_agent',
  REGISTERED_DEVELOPER: 'registered_developer',
  ADMIN: 'admin',
} as const;

export const LISTING_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  CLOSED: 'closed',
} as const;

export const LISTING_TYPE = {
  SALE: 'sale',
  RENT: 'rent',
} as const;

/** Rent period: price is per day, month, or year (for rent listings only) */
export const RENT_PERIOD = {
  DAY: 'day',
  MONTH: 'month',
  YEAR: 'year',
} as const;

export const PROPERTY_TYPES = [
  'apartment',
  'house',
  'land',
  'commercial',
  'duplex',
  'penthouse',
  'studio',
  'terrace',
  'villa',
] as const;

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
} as const;

/** Subscription tiers for listing/media limits. Guest = unauthenticated-style limits. */
export const SUBSCRIPTION_TIERS = {
  GUEST: 'guest',
  FREE: 'free',
  GOLD: 'gold',
  PREMIUM: 'premium',
} as const;

/** Default limits per tier when no admin config exists. */
export const DEFAULT_SUBSCRIPTION_LIMITS: Record<string, {
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  maxFeatured: number;
  maxHighlighted: number;
  priceMonthly: number;
}> = {
  guest: { maxListings: 5, maxImages: 5, maxVideos: 1, canFeatured: false, canHighlighted: false, maxFeatured: 0, maxHighlighted: 0, priceMonthly: 0 },
  free: { maxListings: 5, maxImages: 5, maxVideos: 1, canFeatured: false, canHighlighted: false, maxFeatured: 0, maxHighlighted: 0, priceMonthly: 0 },
  gold: { maxListings: 20, maxImages: 15, maxVideos: 3, canFeatured: true, canHighlighted: true, maxFeatured: 5, maxHighlighted: 5, priceMonthly: 10000 },
  premium: { maxListings: 100, maxImages: 25, maxVideos: 5, canFeatured: true, canHighlighted: true, maxFeatured: 15, maxHighlighted: 15, priceMonthly: 30000 },
};
