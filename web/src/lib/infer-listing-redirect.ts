import { NIGERIAN_STATES } from '@/lib/constants';
import {
  buildLocationLandingPath,
  resolveCityFromSlug,
  resolveStateFromSlug,
  slugToDisplayName,
} from '@/lib/location-seo';
import { getCitiesForState } from '@/lib/nigeria-locations';
import { listingSlugDedupeBase } from '@/lib/listing-slug';
import { slugify } from '@/lib/slugify';

/** Guess a browse destination from a deleted listing URL segment (slug or ObjectId). */
export function inferRedirectDestinationFromListingSegment(segment: string): string {
  const base = listingSlugDedupeBase(segment.trim());
  if (!base) return '/listings';
  if (/^[a-f0-9]{24}$/i.test(base)) return '/listings';

  const parts = base.split('-').filter(Boolean);
  if (!parts.length) return '/listings';

  const last = parts[parts.length - 1]!;

  for (const state of NIGERIAN_STATES) {
    const cityMatch = getCitiesForState(state).find((city) => slugify(city) === last);
    if (cityMatch) {
      return buildLocationLandingPath(state, { city: cityMatch });
    }
  }

  const stateFromLast = resolveStateFromSlug(last);
  if (stateFromLast) {
    return buildLocationLandingPath(stateFromLast);
  }

  if (parts.length >= 2) {
    const penultimate = parts[parts.length - 2]!;
    const stateFromPen = resolveStateFromSlug(penultimate);
    if (stateFromPen) {
      const city = resolveCityFromSlug(stateFromPen, last) ?? slugToDisplayName(last);
      if (city.length >= 2) {
        return buildLocationLandingPath(stateFromPen, { city });
      }
      return buildLocationLandingPath(stateFromPen);
    }
  }

  return '/listings';
}
