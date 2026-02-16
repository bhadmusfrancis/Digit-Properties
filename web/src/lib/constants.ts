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

export const CLAIM_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const PAYMENT_PURPOSE = {
  BOOST_LISTING: 'boost_listing',
  BANNER_AD: 'banner_ad',
} as const;
