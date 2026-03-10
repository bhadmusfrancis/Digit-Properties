import { NextResponse } from 'next/server';
import { extractSuburbFromDisplayName, matchKnownSuburb } from '@/lib/nigeria-suburbs';
import { NIGERIAN_STATES } from '@/lib/constants';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const UA = 'DigitProperties/1.0';

const GOOGLE_GEOCODE_KEY = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

type GeoResult = { address: string; city: string; state: string; suburb: string; lat: number; lng: number };

function getSuburb(addr: Record<string, string>, displayName: string, city: string, state: string): string {
  const fromAddr =
    addr.suburb ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.locality ||
    addr.district ||
    addr.city_district ||
    addr.borough ||
    '';
  if (fromAddr) return fromAddr;
  const known = matchKnownSuburb(displayName || '', state);
  if (known) return known;
  return extractSuburbFromDisplayName(displayName || '', city, state);
}

function normState(s: string): string {
  const t = (s || '').trim();
  if (t.toLowerCase() === 'federal capital territory') return 'FCT';
  const match = NIGERIAN_STATES.find((st) => st.toLowerCase() === t.toLowerCase());
  return match || t || NIGERIAN_STATES[0];
}

/** Parse Google Geocoding API address_components into our shape */
function parseGoogleAddressComponents(components: { long_name: string; short_name: string; types: string[] }[]): { city: string; state: string; suburb: string } {
  let city = '';
  let state = '';
  let suburb = '';
  for (const c of components) {
    if (c.types.includes('locality')) city = c.long_name;
    else if (c.types.includes('administrative_area_level_1')) state = c.long_name;
    else if (c.types.includes('sublocality') || c.types.includes('sublocality_level_1')) suburb = suburb || c.long_name;
    else if (c.types.includes('neighborhood')) suburb = suburb || c.long_name;
    else if (c.types.includes('administrative_area_level_2') && !city) city = c.long_name;
  }
  return { city, state: normState(state), suburb };
}

async function googleGeocodeForward(q: string): Promise<GeoResult[]> {
  if (!GOOGLE_GEOCODE_KEY || q.trim().length < 3) return [];
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q.trim())}&key=${GOOGLE_GEOCODE_KEY}&region=ng`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
  const results = (data.results || []) as {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    address_components: { long_name: string; short_name: string; types: string[] }[];
  }[];
  return results.slice(0, 8).map((r) => {
    const { city, state, suburb } = parseGoogleAddressComponents(r.address_components || []);
    return {
      address: r.formatted_address || '',
      city: city || suburb || 'Nigeria',
      state,
      suburb: suburb || '',
      lat: r.geometry?.location?.lat ?? 0,
      lng: r.geometry?.location?.lng ?? 0,
    };
  });
}

async function googleReverseGeocode(lat: string, lon: string): Promise<GeoResult | null> {
  if (!GOOGLE_GEOCODE_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lon)}&key=${GOOGLE_GEOCODE_KEY}&region=ng`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  const r = data.results[0] as {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    address_components: { long_name: string; short_name: string; types: string[] }[];
  };
  const { city, state, suburb } = parseGoogleAddressComponents(r.address_components || []);
  return {
    address: r.formatted_address || '',
    city: city || suburb || 'Nigeria',
    state,
    suburb: suburb || '',
    lat: parseFloat(lat),
    lng: parseFloat(lon),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (lat != null && lon != null) {
      if (GOOGLE_GEOCODE_KEY) {
        const googleResult = await googleReverseGeocode(lat, lon);
        if (googleResult) return NextResponse.json(googleResult);
      }
      const url = NOMINATIM_BASE + '/reverse?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&format=json&addressdetails=1';
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error }, { status: 400 });
      const addr = data.address || {};
      const fromCity = addr.city || addr.town || addr.village || addr.county || addr.state || '';
      const state = addr.state || '';
      const fromSuburb = getSuburb(addr, data.display_name || '', fromCity, state);
      return NextResponse.json({
        address: data.display_name || '',
        city: fromSuburb || fromCity,
        state: normState(state),
        suburb: fromSuburb ? fromCity : '',
        lat: parseFloat(lat),
        lng: parseFloat(lon),
      });
    }

    if (!q || q.trim().length < 3) {
      return NextResponse.json({ results: [] });
    }

    if (GOOGLE_GEOCODE_KEY) {
      const googleResults = await googleGeocodeForward(q);
      if (googleResults.length > 0) return NextResponse.json({ results: googleResults });
    }

    const searchUrl = NOMINATIM_BASE + '/search?q=' + encodeURIComponent(q.trim()) + '&format=json&addressdetails=1&limit=8';
    const res = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
    const results = await res.json();
    if (!Array.isArray(results)) return NextResponse.json({ results: [] });

    const out = results.map((r: { lat: string; lon: string; display_name: string; address?: Record<string, string> }) => {
      const addr = r.address || {};
      const fromCity = addr.city || addr.town || addr.village || addr.county || addr.state || '';
      const state = addr.state || '';
      const fromSuburb = getSuburb(addr, r.display_name, fromCity, state);
      return {
        address: r.display_name,
        city: fromSuburb || fromCity,
        state: normState(state),
        suburb: fromSuburb ? fromCity : '',
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      };
    });
    return NextResponse.json({ results: out });
  } catch (e) {
    console.error('[geocode]', e);
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
  }
}
