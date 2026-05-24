import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { LISTING_STATUS } from '@/lib/constants';
import { slugify } from '@/lib/slugify';
import {
  resolveCityFromSlug,
  resolveSuburbFromSlug,
  slugToDisplayName,
  type ResolvedPlace,
} from '@/lib/location-seo';

/** Match place slug against active listing city/suburb values in DB. */
async function resolvePlaceFromDb(state: string, placeSlug: string): Promise<ResolvedPlace | null> {
  await dbConnect();
  const key = placeSlug.trim().toLowerCase();
  const baseMatch = { status: LISTING_STATUS.ACTIVE, 'location.state': state };

  const [cities, suburbs] = await Promise.all([
    Listing.distinct('location.city', baseMatch),
    Listing.distinct('location.suburb', {
      ...baseMatch,
      'location.suburb': { $exists: true, $nin: [null, ''] },
    }),
  ]);

  const cityMatch = cities.find(
    (value) => typeof value === 'string' && slugify(value) === key
  );
  if (typeof cityMatch === 'string' && cityMatch.trim()) {
    return { placeName: cityMatch.trim(), city: cityMatch.trim() };
  }

  const suburbMatch = suburbs.find(
    (value) => typeof value === 'string' && slugify(value) === key
  );
  if (typeof suburbMatch === 'string' && suburbMatch.trim()) {
    return { placeName: suburbMatch.trim(), suburb: suburbMatch.trim() };
  }

  return null;
}

/** Resolve a location landing place segment (static data, then DB). */
export async function resolvePlaceForLanding(
  state: string,
  placeSlug: string
): Promise<ResolvedPlace | null> {
  const staticCity = resolveCityFromSlug(state, placeSlug);
  if (staticCity) return { placeName: staticCity, city: staticCity };

  const fromDb = await resolvePlaceFromDb(state, placeSlug);
  if (fromDb) return fromDb;

  const staticSuburb = resolveSuburbFromSlug(state, placeSlug);
  if (staticSuburb) {
    return {
      placeName: staticSuburb.suburb,
      city: staticSuburb.city,
      suburb: staticSuburb.suburb,
    };
  }

  const label = slugToDisplayName(placeSlug);
  if (label.length >= 2) {
    return { placeName: label, city: label };
  }
  return null;
}
