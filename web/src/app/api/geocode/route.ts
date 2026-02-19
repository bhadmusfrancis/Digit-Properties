import { NextResponse } from 'next/server';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const UA = 'DigitProperties/1.0 (contact@digitproperties.com)';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (lat != null && lon != null) {
      const url = NOMINATIM_BASE + '/reverse?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&format=json&addressdetails=1';
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error }, { status: 400 });
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || addr.state || '';
      const state = addr.state || '';
      const suburb =
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        addr.locality ||
        addr.district ||
        addr.city_district ||
        addr.borough ||
        '';
      return NextResponse.json({
        address: data.display_name || '',
        city,
        state,
        suburb,
        lat: parseFloat(lat),
        lng: parseFloat(lon),
      });
    }

    if (!q || q.trim().length < 3) {
      return NextResponse.json({ results: [] });
    }

    const searchUrl = NOMINATIM_BASE + '/search?q=' + encodeURIComponent(q.trim()) + '&format=json&addressdetails=1&limit=8';
    const res = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
    const results = await res.json();
    if (!Array.isArray(results)) return NextResponse.json({ results: [] });

    const out = results.map((r: { lat: string; lon: string; display_name: string; address?: Record<string, string> }) => {
      const addr = r.address || {};
      return {
        address: r.display_name,
        city: addr.city || addr.town || addr.village || addr.county || addr.state || '',
        state: addr.state || '',
        suburb:
          addr.suburb ||
          addr.neighbourhood ||
          addr.quarter ||
          addr.locality ||
          addr.district ||
          addr.city_district ||
          addr.borough ||
          '',
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
