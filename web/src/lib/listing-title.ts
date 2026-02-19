/**
 * Generate SEO-friendly listing title from form data (web + mobile).
 * Mix: listing type, property type, state, city, suburb, bedrooms, bathrooms, toilets, area, amenities, description keywords.
 */
export interface TitleInput {
  listingType: string;
  propertyType: string;
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

export function generateListingTitle(input: TitleInput): string {
  const parts: string[] = [];

  const beds = input.bedrooms ?? 0;
  const prop = capitalize((input.propertyType || '').replace(/_/g, ' '));
  const type = input.listingType === 'rent' ? 'for Rent' : 'for Sale';

  if (beds > 0) {
    parts.push(`${beds}-Bedroom ${prop} ${type}`);
  } else {
    parts.push(`${prop} ${type}`);
  }

  const locationParts: string[] = [];
  if (input.suburb?.trim()) locationParts.push(input.suburb.trim());
  if (input.city?.trim()) locationParts.push(input.city.trim());
  if (input.state?.trim()) locationParts.push(input.state.trim());
  if (locationParts.length > 0) {
    parts.push('in');
    parts.push(locationParts.join(', '));
  }

  const extras: string[] = [];
  if ((input.bathrooms ?? 0) > 0) extras.push(`${input.bathrooms} baths`);
  if ((input.toilets ?? 0) > 0) extras.push(`${input.toilets} toilets`);
  if ((input.area ?? 0) > 0) extras.push(`${input.area} sqm`);
  if (input.amenities?.length) {
    const top = input.amenities.slice(0, 2).join(', ');
    if (top) extras.push(top);
  }
  const fromDesc = pickFromDescription(input.description || '', 1);
  if (fromDesc.length) extras.push(fromDesc[0]);

  if (extras.length > 0) {
    parts.push('—');
    parts.push(extras.slice(0, 3).join(' · '));
  }

  let title = parts.join(' ');
  if (title.length > 200) title = title.slice(0, 197) + '...';
  return title.trim() || 'Property Listing';
}
