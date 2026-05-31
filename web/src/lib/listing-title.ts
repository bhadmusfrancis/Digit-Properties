/**
 * Generate SEO-friendly listing title from form data (web + mobile).
 * Uses "at" for location, e.g. "3 Bed Apartment at Ikotun, Lagos".
 */
import { formatListingLocationDisplay } from '@/lib/listing-location';
import {
  isNonBedroomPropertyType,
  reorderPropertyTypesForBedrooms,
} from '@/lib/constants';

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

function normalizedPropertyTypes(input: TitleInput): string[] {
  const types =
    input.propertyTypes?.length && input.propertyTypes.length > 0
      ? input.propertyTypes
      : input.propertyType
        ? [input.propertyType]
        : [];
  const beds = input.bedrooms ?? 0;
  const ordered = reorderPropertyTypesForBedrooms(types, beds);
  if (ordered.length) return ordered;
  return ['apartment'];
}

/** Property slugs to show in a title; never pair bedroom counts with land or similar. */
function titlePropertyTypes(input: TitleInput): string[] {
  const beds = input.bedrooms ?? 0;
  const types = normalizedPropertyTypes(input);

  if (beds <= 0) return types;

  let residential = types.filter((t) => !isNonBedroomPropertyType(t));
  if (!residential.length) residential = ['house'];
  return residential;
}

/** Whether the title should include a bedroom count for this listing. */
function shouldIncludeBedrooms(input: TitleInput): boolean {
  const beds = input.bedrooms ?? 0;
  if (beds <= 0) return false;
  return titlePropertyTypes(input).some((t) => !isNonBedroomPropertyType(t));
}

/** Build title using one of several formats at random. */
function propertyTypesDisplay(input: TitleInput): string {
  const types = titlePropertyTypes(input);
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
  if (shouldIncludeBedrooms(input)) parts.push(`${beds} Bed`);
  parts.push(prop);
  const title = `${parts.join(' ')} at ${place}`;
  if (title.length > 200) return title.slice(0, 197) + '...';
  return title.trim() || 'Property';
}

export function generateListingTitle(input: TitleInput): string {
  const beds = input.bedrooms ?? 0;
  const area = input.area ?? 0;
  const prop = propertyTypesDisplay(input);
  const includeBeds = shouldIncludeBedrooms(input);
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
      includeBeds
        ? `${areaStr}${beds} Bed ${prop} at ${loc || 'Nigeria'}`
        : `${areaStr}${prop} at ${loc || 'Nigeria'}`,
    () =>
      loc
        ? `${areaStr}${prop} ${typeStr} – ${loc}`
        : `${areaStr}${prop} ${typeStr}`,
    () =>
      includeBeds && loc
        ? `${areaStr}${beds}-Bedroom ${prop} ${typeStr} at ${loc}`
        : includeBeds
          ? `${areaStr}${beds}-Bedroom ${prop} ${typeStr}`
          : `${areaStr}${prop} ${typeStr}`,
    () => {
      const lead = `${areaStr}${includeBeds ? `${beds}-Bedroom ${prop}` : prop}`;
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
