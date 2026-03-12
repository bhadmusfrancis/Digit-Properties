import { NextResponse } from 'next/server';
import { NIGERIA_AREAS_BY_STATE } from '@/lib/nigeria-suburbs';
import { NIGERIAN_STATES } from '@/lib/constants';

/** GET /api/locations/areas?state=Lagos — returns suburbs/areas for the given state (for alert & search dropdowns). */
export async function GET(req: Request) {
  const state = req.nextUrl.searchParams.get('state')?.trim();
  if (!state) {
    return NextResponse.json({ areas: [], states: NIGERIAN_STATES });
  }
  const areas = NIGERIA_AREAS_BY_STATE[state] ?? [];
  return NextResponse.json({ areas, state });
}
