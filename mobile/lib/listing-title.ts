/**
 * Generate listing title with "at" for location (same rules as web).
 * e.g. "3 Bed Apartment at Ikotun, Lagos"
 */

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
  const prop = (params.propertyType || 'property').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const typeStr =
    params.listingType === 'rent'
      ? 'for Rent'
      : params.listingType === 'joint_venture'
        ? 'Joint Venture'
        : 'for Sale';
  const loc = formatTitleLocation(params) || 'Nigeria';
  // Lead with area so otherwise-identical listings get distinct titles (avoids duplicate clustering).
  const areaStr = area > 0 ? `${Math.round(area)} sqm ` : '';
  if (beds > 0) {
    return `${areaStr}${beds} Bed ${prop} at ${loc}`;
  }
  return `${areaStr}${prop} ${typeStr} at ${loc}`;
}
