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
  const prop = propertyTypesDisplay(input);
  const loc = locationStr(input);
  const place = loc || 'Nigeria';
  const title =
    beds > 0 ? `${beds} Bed ${prop} at ${place}` : `${prop} at ${place}`;
  if (title.length > 200) return title.slice(0, 197) + '...';
  return title.trim() || 'Property';
}

export function generateListingTitle(input: TitleInput): string {
  const beds = input.bedrooms ?? 0;
  const prop = propertyTypesDisplay(input);
  const typeStr =
    input.listingType === 'rent'
      ? 'for Rent'
      : input.listingType === 'joint_venture'
        ? 'Joint Venture'
        : 'for Sale';
  const loc = locationStr(input);

  const formats: Array<() => string> = [
    () =>
      beds > 0
        ? `${beds} Bed ${prop} at ${loc || 'Nigeria'}`
        : `${prop} at ${loc || 'Nigeria'}`,
    () =>
      loc
        ? `${prop} ${typeStr} – ${loc}`
        : `${prop} ${typeStr}`,
    () =>
      beds > 0 && loc
        ? `${beds}-Bedroom ${prop} ${typeStr} at ${loc}`
        : beds > 0
          ? `${beds}-Bedroom ${prop} ${typeStr}`
          : `${prop} ${typeStr}`,
    () => {
      const parts: string[] = beds > 0 ? [`${beds}-Bedroom ${prop}`, typeStr] : [`${prop}`, typeStr];
      if (loc) parts.push('at', loc);
      return parts.join(' ');
    },
    () =>
      loc
        ? `${prop} at ${loc} – ${typeStr}`
        : `${prop} ${typeStr}`,
  ];

  const fn = formats[Math.floor(Math.random() * formats.length)];
  let title = fn();
  if (title.length > 200) title = title.slice(0, 197) + '...';
  return title.trim() || 'Property';
}
