import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { LISTING_STATUS } from '@/lib/constants';
import { getSuburbsForCity } from '@/lib/nigeria-locations';

/** GET /api/locations/suburbs?state=Lagos&city=Ikeja — distinct suburbs from active listings merged with static State→City→Suburbs data. */
export async function GET(req: Request) {
  const state = req.nextUrl.searchParams.get('state')?.trim();
  const city = req.nextUrl.searchParams.get('city')?.trim();
  if (!state || !city) {
    return NextResponse.json({ suburbs: [] });
  }
  const staticSuburbs = getSuburbsForCity(state, city);
  try {
    await dbConnect();
    const dbSuburbs = await Listing.distinct('location.suburb', {
      'location.state': state,
      'location.city': city,
      status: LISTING_STATUS.ACTIVE,
    });
    const fromDb = (dbSuburbs as string[]).filter(Boolean);
    const merged = [...new Set([...staticSuburbs, ...fromDb])].sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ suburbs: merged, state, city });
  } catch (e) {
    console.error('[locations/suburbs]', e);
    return NextResponse.json({ suburbs: staticSuburbs, state, city });
  }
}
