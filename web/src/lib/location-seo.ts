import { LISTING_TYPE, NIGERIAN_STATES } from '@/lib/constants';
import { getCitiesForState } from '@/lib/nigeria-locations';
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

export function isListingTypeUrlSlug(value: string): value is ListingTypeUrlSlug {
  return value in LISTING_TYPE_URL_SLUGS;
}

export type LocationLandingParams = {
  state: string;
  city?: string;
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
  options?: { city?: string; listingType?: string }
): string {
  const parts = [`/listings/in/${stateToSlug(state)}`];
  if (options?.city) parts.push(cityToSlug(options.city));
  const typeSlug = listingTypeToUrlSlug(options?.listingType);
  if (typeSlug) parts.push(typeSlug);
  return parts.join('/');
}

export function buildLocationLandingMetadata(input: LocationLandingParams & { state: string }) {
  const { state, city, listingType } = input;
  const place = city ? `${city}, ${state}` : state === 'FCT' ? 'Abuja (FCT)' : state;
  let intent = 'for sale and rent';
  if (listingType === LISTING_TYPE.SALE) intent = 'for sale';
  else if (listingType === LISTING_TYPE.RENT) intent = 'for rent';
  else if (listingType === LISTING_TYPE.JOINT_VENTURE) intent = 'for joint venture';

  const title = city
    ? `Properties ${intent} in ${city}, ${state}`
    : `Properties ${intent} in ${place}`;

  const description = city
    ? `Browse apartments, houses, land, and commercial properties ${intent} in ${city}, ${state}. Verified listings on Digit Properties — Nigeria's real estate platform.`
    : `Find apartments, houses, land, and commercial properties ${intent} across ${place}. Search verified Nigerian property listings on Digit Properties.`;

  return { title, description, place };
}

export function locationLandingPresetFilters(input: LocationLandingParams & { state: string }): Record<string, string> {
  const filters: Record<string, string> = { state: input.state };
  if (input.city) filters.city = input.city;
  if (input.listingType) filters.listingType = input.listingType;
  return filters;
}

export function relatedLocationLinks(
  state: string,
  options?: { city?: string; listingType?: string }
): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [];
  const stateLabel = state === 'FCT' ? 'Abuja' : state;

  if (options?.city) {
    links.push({ href: buildLocationLandingPath(state), label: `All ${stateLabel} properties` });
    if (!options.listingType) {
      links.push({ href: buildLocationLandingPath(state, { city: options.city, listingType: LISTING_TYPE.SALE }), label: `For sale in ${options.city}` });
      links.push({ href: buildLocationLandingPath(state, { city: options.city, listingType: LISTING_TYPE.RENT }), label: `For rent in ${options.city}` });
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
