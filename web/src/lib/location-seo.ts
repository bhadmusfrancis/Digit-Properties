import { LISTING_TYPE, NIGERIAN_STATES } from '@/lib/constants';
import { getCitiesForState, getSuburbsForCity } from '@/lib/nigeria-locations';
import { slugify } from '@/lib/slugify';

export const LISTING_TYPE_URL_SLUGS = {
  'for-sale': LISTING_TYPE.SALE,
  'for-rent': LISTING_TYPE.RENT,
  'joint-venture': LISTING_TYPE.JOINT_VENTURE,
} as const;

export type ListingTypeUrlSlug = keyof typeof LISTING_TYPE_URL_SLUGS;

const LISTING_TYPE_TO_URL: Record<string, ListingTypeUrlSlug> = {
  [LISTING_TYPE.SALE]: 'for-sale',
  [LISTING_TYPE.RENT]: 'for-rent',
  [LISTING_TYPE.JOINT_VENTURE]: 'joint-venture',
};

/** Alternate URL slugs that resolve to a canonical state name. */
const STATE_SLUG_ALIASES: Record<string, string> = {
  abuja: 'FCT',
};

/** Featured markets for homepage/footer internal links. */
export const FEATURED_PROPERTY_MARKETS = [
  { state: 'Lagos', label: 'Lagos', city: undefined as string | undefined },
  { state: 'FCT', label: 'Abuja', city: undefined },
  { state: 'Rivers', label: 'Port Harcourt', city: 'Port Harcourt' },
  { state: 'Ogun', label: 'Ogun', city: undefined },
  { state: 'Kano', label: 'Kano', city: undefined },
  { state: 'Delta', label: 'Delta', city: undefined },
] as const;

export function stateToSlug(state: string): string {
  return slugify(state);
}

export function cityToSlug(city: string): string {
  return slugify(city);
}

export function listingTypeToUrlSlug(listingType?: string): ListingTypeUrlSlug | undefined {
  if (!listingType) return undefined;
  return LISTING_TYPE_TO_URL[listingType];
}

export function resolveStateFromSlug(stateSlug: string): string | null {
  const key = stateSlug.trim().toLowerCase();
  if (STATE_SLUG_ALIASES[key]) return STATE_SLUG_ALIASES[key];
  const match = NIGERIAN_STATES.find((s) => slugify(s) === key);
  return match ?? null;
}

export function resolveCityFromSlug(state: string, citySlug: string): string | null {
  const key = citySlug.trim().toLowerCase();
  const cities = getCitiesForState(state);
  const match = cities.find((c) => slugify(c) === key);
  return match ?? null;
}

export function slugToDisplayName(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export type ResolvedPlace = {
  /** Display label for headings/metadata */
  placeName: string;
  /** City filter (when applicable) */
  city?: string;
  /** Suburb/area filter (when applicable) */
  suburb?: string;
};

export function resolveSuburbFromSlug(state: string, suburbSlug: string): { city: string; suburb: string } | null {
  const key = suburbSlug.trim().toLowerCase();
  for (const city of getCitiesForState(state)) {
    const suburb = getSuburbsForCity(state, city).find((s) => slugify(s) === key);
    if (suburb) return { city, suburb };
  }
  return null;
}

/** Resolve a URL place segment against static city/suburb lists (no DB). */
export function resolvePlaceFromSlug(state: string, placeSlug: string): ResolvedPlace | null {
  const city = resolveCityFromSlug(state, placeSlug);
  if (city) return { placeName: city, city };

  const label = slugToDisplayName(placeSlug);
  if (label.length >= 2) {
    return { placeName: label, city: label };
  }
  return null;
}

export function isListingTypeUrlSlug(value: string): value is ListingTypeUrlSlug {
  return value in LISTING_TYPE_URL_SLUGS;
}

export type LocationLandingParams = {
  state: string;
  placeName: string;
  city?: string;
  suburb?: string;
  listingType?: string;
};

export type LocationLandingRestParams = Partial<Pick<LocationLandingParams, 'city' | 'listingType'>>;

export function parseLocationLandingRest(rest?: string[]): LocationLandingRestParams | null {
  if (!rest?.length) return {};
  if (rest.length === 1) {
    const seg = rest[0]!.toLowerCase();
    if (isListingTypeUrlSlug(seg)) {
      return { listingType: LISTING_TYPE_URL_SLUGS[seg] };
    }
    return { city: rest[0]! };
  }
  if (rest.length === 2) {
    const typeSeg = rest[1]!.toLowerCase();
    if (!isListingTypeUrlSlug(typeSeg)) return null;
    return {
      city: rest[0]!,
      listingType: LISTING_TYPE_URL_SLUGS[typeSeg],
    };
  }
  return null;
}

export function buildLocationLandingPath(
  state: string,
  options?: { city?: string; suburb?: string; listingType?: string }
): string {
  const parts = [`/listings/in/${stateToSlug(state)}`];
  const place = options?.suburb?.trim() || options?.city?.trim();
  if (place) parts.push(cityToSlug(place));
  const typeSlug = listingTypeToUrlSlug(options?.listingType);
  if (typeSlug) parts.push(typeSlug);
  return parts.join('/');
}

export function buildLocationLandingMetadata(input: LocationLandingParams & { state: string }) {
  const { state, placeName, listingType } = input;
  const place = placeName;
  const stateLabel = state === 'FCT' ? 'Abuja (FCT)' : state;
  let intent = 'for sale and rent';
  if (listingType === LISTING_TYPE.SALE) intent = 'for sale';
  else if (listingType === LISTING_TYPE.RENT) intent = 'for rent';
  else if (listingType === LISTING_TYPE.JOINT_VENTURE) intent = 'for joint venture';

  const title = `Properties ${intent} in ${place}, ${stateLabel}`;

  const description = `Browse apartments, houses, land, and commercial properties ${intent} in ${place}, ${state}. Verified listings on Digit Properties — Nigeria's real estate platform.`;

  return { title, description, place };
}

export function locationLandingPresetFilters(input: LocationLandingParams & { state: string }): Record<string, string> {
  const filters: Record<string, string> = { state: input.state };
  if (input.city) filters.city = input.city;
  if (input.suburb) filters.suburb = input.suburb;
  if (input.listingType) filters.listingType = input.listingType;
  return filters;
}

export function relatedLocationLinks(
  state: string,
  options?: { placeName?: string; city?: string; suburb?: string; listingType?: string }
): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [];
  const stateLabel = state === 'FCT' ? 'Abuja' : state;
  const place = options?.placeName ?? options?.suburb ?? options?.city;

  if (place) {
    links.push({ href: buildLocationLandingPath(state), label: `All ${stateLabel} properties` });
    if (!options?.listingType) {
      links.push({
        href: buildLocationLandingPath(state, {
          city: options?.city,
          suburb: options?.suburb,
          listingType: LISTING_TYPE.SALE,
        }),
        label: `For sale in ${place}`,
      });
      links.push({
        href: buildLocationLandingPath(state, {
          city: options?.city,
          suburb: options?.suburb,
          listingType: LISTING_TYPE.RENT,
        }),
        label: `For rent in ${place}`,
      });
    }
  } else {
    links.push({ href: buildLocationLandingPath(state, { listingType: LISTING_TYPE.SALE }), label: `Properties for sale in ${stateLabel}` });
    links.push({ href: buildLocationLandingPath(state, { listingType: LISTING_TYPE.RENT }), label: `Properties for rent in ${stateLabel}` });
    const cities = getCitiesForState(state).slice(0, 6);
    for (const c of cities) {
      links.push({ href: buildLocationLandingPath(state, { city: c }), label: c });
    }
  }

  return links;
}
