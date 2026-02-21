/**
 * Generate listing title with "at" for location (same as web).
 * e.g. "3 Bed Apartment at Jakande, Baale Street, Lagos"
 */

export function generateListingTitle(params: {
  listingType: string;
  propertyType: string;
  address?: string;
  city?: string;
  state?: string;
  suburb?: string;
  bedrooms?: number;
}): string {
  const beds = params.bedrooms ?? 0;
  const prop = (params.propertyType || 'property').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const typeStr = params.listingType === 'rent' ? 'for Rent' : 'for Sale';
  const parts: string[] = [];
  if (params.suburb?.trim()) parts.push(params.suburb.trim());
  if (params.address?.trim()) parts.push(params.address.trim());
  if (params.city?.trim()) parts.push(params.city.trim());
  if (params.state?.trim()) parts.push(params.state.trim());
  const loc = parts.join(', ') || 'Nigeria';
  if (beds > 0) {
    return `${beds} Bed ${prop} at ${loc}`;
  }
  return `${prop} ${typeStr} at ${loc}`;
}
