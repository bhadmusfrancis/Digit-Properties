/** Keep in sync with web/src/lib/constants.ts (PROPERTY_TYPES, LISTING_TYPE). */
export const LISTING_TYPE = {
  SALE: 'sale',
  RENT: 'rent',
  JOINT_VENTURE: 'joint_venture',
} as const;

export type ListingType = (typeof LISTING_TYPE)[keyof typeof LISTING_TYPE];

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

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const;

export const RENT_PERIODS = ['day', 'month', 'year'] as const;

export const POPULAR_AMENITIES = [
  'Parking', 'Security', '24hr Power', 'Generator', 'Pool', 'Gym',
  'Fitted Kitchen', 'BQ', 'Garden', 'Water Supply', 'Elevator', 'AC', 'WiFi', 'CCTV', 'Serviced',
] as const;

export function formatPropertyTypeLabel(slug: string): string {
  if (!slug) return '';
  return slug
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export function formatListingTypeLabel(t: string): string {
  if (t === LISTING_TYPE.JOINT_VENTURE) return 'Joint venture';
  if (t === LISTING_TYPE.RENT) return 'Rent';
  if (t === LISTING_TYPE.SALE) return 'Sale';
  return formatPropertyTypeLabel(t);
}
