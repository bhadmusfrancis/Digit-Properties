/**
 * Generate SEO-friendly listing title from form data (web + mobile).
 * Uses "at" for location, e.g. "3 Bed Apartment at Ikotun, Lagos".
 */
import { formatListingLocationDisplay } from '@/lib/listing-location';
export interface TitleInput {
  listingType: string;
  propertyType: string;
  /** When set (up to 3), used for titles instead of a single propertyType. */
  propertyTypes?: string[];
  address?: string;
  state?: string;
  city?: string;
  suburb?: string;
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  area?: number;
  amenities?: string[];
  description?: string;
}

const EXCITING_WORDS = [
  'luxury', 'modern', 'spacious', 'beautiful', 'stunning', 'prime', 'exclusive',
  'serene', 'elegant', 'contemporary', 'fully', 'fitted', 'secure', 'affordable',
  'ideal', 'perfect', 'excellent', 'premium', 'cozy', 'family', 'executive',
];

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

/** Suburb, then city, then state; free-text address only when structured fields are empty. */
function locationStr(input: TitleInput): string {
  return formatListingLocationDisplay({
    address: input.address,
    suburb: input.suburb,
    city: input.city,
    state: input.state,
  });
}

function pickFromDescription(description: string, maxWords = 2): string[] {
  if (!description || !description.trim()) return [];
  const lower = description.toLowerCase();
  const found: string[] = [];
  for (const w of EXCITING_WORDS) {
    if (lower.includes(w)) found.push(capitalize(w));
    if (found.length >= maxWords) break;
  }
  return found;
}

/** Build title using one of several formats at random. */
function propertyTypesDisplay(input: TitleInput): string {
  const types =
    input.propertyTypes?.length && input.propertyTypes.length > 0
      ? input.propertyTypes
      : input.propertyType
        ? [input.propertyType]
        : [];
  if (!types.length) return 'Property';
  return types.map((t) => capitalize((t || '').replace(/_/g, ' '))).join(' & ');
}

/**
 * Stable title format for backfills and whenever titles must not vary between runs.
 * e.g. "3 Bed Apartment at Ikotun, Lagos" or "Apartment at Ikotun"
 */
export function buildCanonicalListingTitle(input: TitleInput): string {
  const beds = input.bedrooms ?? 0;
  const area = input.area ?? 0;
  const prop = propertyTypesDisplay(input);
  const loc = locationStr(input);
  const place = loc || 'Nigeria';
  // Lead with area/beds so otherwise-identical listings (e.g. several "Land at Ikoyi")
  // get distinct titles and don't get clustered as duplicates by search engines.
  const parts: string[] = [];
  if (area > 0) parts.push(`${Math.round(area)} sqm`);
  if (beds > 0) parts.push(`${beds} Bed`);
  parts.push(prop);
  const title = `${parts.join(' ')} at ${place}`;
  if (title.length > 200) return title.slice(0, 197) + '...';
  return title.trim() || 'Property';
}

export function generateListingTitle(input: TitleInput): string {
  const beds = input.bedrooms ?? 0;
  const area = input.area ?? 0;
  const prop = propertyTypesDisplay(input);
  const typeStr =
    input.listingType === 'rent'
      ? 'for Rent'
      : input.listingType === 'joint_venture'
        ? 'Joint Venture'
        : 'for Sale';
  const loc = locationStr(input);
  // Lead with area so otherwise-identical listings get distinct titles (avoids duplicate clustering).
  const areaStr = area > 0 ? `${Math.round(area)} sqm ` : '';

  const formats: Array<() => string> = [
    () =>
      beds > 0
        ? `${areaStr}${beds} Bed ${prop} at ${loc || 'Nigeria'}`
        : `${areaStr}${prop} at ${loc || 'Nigeria'}`,
    () =>
      loc
        ? `${areaStr}${prop} ${typeStr} – ${loc}`
        : `${areaStr}${prop} ${typeStr}`,
    () =>
      beds > 0 && loc
        ? `${areaStr}${beds}-Bedroom ${prop} ${typeStr} at ${loc}`
        : beds > 0
          ? `${areaStr}${beds}-Bedroom ${prop} ${typeStr}`
          : `${areaStr}${prop} ${typeStr}`,
    () => {
      const lead = `${areaStr}${beds > 0 ? `${beds}-Bedroom ${prop}` : prop}`;
      const parts: string[] = [lead, typeStr];
      if (loc) parts.push('at', loc);
      return parts.join(' ');
    },
    () =>
      loc
        ? `${areaStr}${prop} at ${loc} – ${typeStr}`
        : `${areaStr}${prop} ${typeStr}`,
  ];

  const fn = formats[Math.floor(Math.random() * formats.length)];
  let title = fn();
  if (title.length > 200) title = title.slice(0, 197) + '...';
  return title.trim() || 'Property';
}
