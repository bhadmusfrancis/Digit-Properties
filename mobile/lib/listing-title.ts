/**
 * Generate listing title with "at" for location (same rules as web).
 * e.g. "3 Bed Apartment at Ikotun, Lagos"
 */

const NON_BEDROOM_PROPERTY_TYPES = new Set([
  'land',
  'commercial',
  'industrial',
  'factory',
  'farm',
  'filling_station',
  'hotel',
  'office',
  'restaurant',
  'shop',
  'warehouse',
  'event_center',
  'mixed_use',
]);

function formatTitleLocation(loc: {
  address?: string;
  suburb?: string;
  city?: string;
  state?: string;
}): string {
  const structured = [loc.suburb, loc.city, loc.state]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);
  if (structured.length > 0) {
    return Array.from(new Map(structured.map((p) => [p.toLowerCase(), p])).values()).join(', ');
  }
  const addr = typeof loc.address === 'string' ? loc.address.trim() : '';
  return addr;
}

function titlePropertyType(propertyType: string, bedrooms: number): string {
  const slug = (propertyType || 'property').toLowerCase();
  if (bedrooms > 0 && NON_BEDROOM_PROPERTY_TYPES.has(slug)) {
    return 'House';
  }
  return (propertyType || 'property').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function generateListingTitle(params: {
  listingType: string;
  propertyType: string;
  address?: string;
  city?: string;
  state?: string;
  suburb?: string;
  bedrooms?: number;
  area?: number;
}): string {
  const beds = params.bedrooms ?? 0;
  const area = params.area ?? 0;
  const prop = titlePropertyType(params.propertyType, beds);
  const includeBeds = beds > 0;
  const typeStr =
    params.listingType === 'rent'
      ? 'for Rent'
      : params.listingType === 'joint_venture'
        ? 'Joint Venture'
        : 'for Sale';
  const loc = formatTitleLocation(params) || 'Nigeria';
  // Lead with area so otherwise-identical listings get distinct titles (avoids duplicate clustering).
  const areaStr = area > 0 ? `${Math.round(area)} sqm ` : '';
  if (includeBeds) {
    return `${areaStr}${beds} Bed ${prop} at ${loc}`;
  }
  return `${areaStr}${prop} ${typeStr} at ${loc}`;
}
