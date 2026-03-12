import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { LISTING_STATUS } from '@/lib/constants';
import { getCitiesForState } from '@/lib/nigeria-locations';
import { NIGERIA_AREAS_BY_STATE } from '@/lib/nigeria-suburbs';

/** GET /api/locations/cities?state=Lagos — distinct cities from active listings merged with static State→Cities (LGAs) data. */
export async function GET(req: Request) {
  const state = req.nextUrl.searchParams.get('state')?.trim();
  if (!state) {
    return NextResponse.json({ cities: [] });
  }
  const staticCities = getCitiesForState(state);
  try {
    await dbConnect();
    const dbCities = await Listing.distinct('location.city', {
      'location.state': state,
      status: LISTING_STATUS.ACTIVE,
    });
    const fromDb = (dbCities as string[]).filter(Boolean);
    const merged = [...new Set([...staticCities, ...fromDb])].sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ cities: merged.length ? merged : (NIGERIA_AREAS_BY_STATE[state] ?? []).sort((a, b) => a.localeCompare(b)), state });
  } catch (e) {
    console.error('[locations/cities]', e);
    const fallback = staticCities.length ? staticCities : (NIGERIA_AREAS_BY_STATE[state] ?? []);
    return NextResponse.json({ cities: fallback.sort((a, b) => a.localeCompare(b)), state });
  }
}
