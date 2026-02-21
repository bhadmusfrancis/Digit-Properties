/**
 * Generate SEO-friendly listing title from form data (web + mobile).
 * Uses "at" for location, e.g. "3 Bed Apartment AT Jakande, Baale Street, Lagos".
 */
export interface TitleInput {
  listingType: string;
  propertyType: string;
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

/** Location string for title: suburb, address, city, state (e.g. "Jakande, Baale Street, Lagos"). */
function locationStr(input: TitleInput): string {
  const parts: string[] = [];
  if (input.suburb?.trim()) parts.push(input.suburb.trim());
  if (input.address?.trim()) parts.push(input.address.trim());
  if (input.city?.trim()) parts.push(input.city.trim());
  if (input.state?.trim()) parts.push(input.state.trim());
  return parts.join(', ');
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
export function generateListingTitle(input: TitleInput): string {
  const beds = input.bedrooms ?? 0;
  const prop = capitalize((input.propertyType || '').replace(/_/g, ' '));
  const typeStr = input.listingType === 'rent' ? 'for Rent' : 'for Sale';
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
  return title.trim() || 'Property Listing';
}
