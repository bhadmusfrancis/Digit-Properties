import { NextResponse } from 'next/server';
import { NIGERIAN_STATES } from '@/lib/constants';

const GOOGLE_PLACES_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;

type PlacesNewAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
    queryPrediction?: {
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

type PlacesTextSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
  }>;
};

type LegacyPlacesAutocompleteResponse = {
  status?: string;
  predictions?: Array<{
    place_id?: string;
    description?: string;
    structured_formatting?: {
      main_text?: string;
      secondary_text?: string;
    };
  }>;
};

type PlaceDetailsResponse = {
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
};

function normStateName(s: string): string {
  const t = (s || '').trim();
  if (t.toLowerCase() === 'federal capital territory') return 'FCT';
  const stateMatch = NIGERIAN_STATES.find((st) => st.toLowerCase() === t.toLowerCase());
  return stateMatch || NIGERIAN_STATES[0];
}

function parseComponents(
  components: Array<{ longText?: string; shortText?: string; types?: string[] }>
): { city: string; state: string; suburb: string } {
  let city = '';
  let state = '';
  let suburb = '';
  for (const c of components) {
    const types = c.types || [];
    const v = (c.longText || c.shortText || '').trim();
    if (!v) continue;
    if (types.includes('locality')) city = v;
    else if (types.includes('administrative_area_level_1')) state = v;
    else if (types.includes('sublocality') || types.includes('sublocality_level_1')) suburb = suburb || v;
    else if (types.includes('neighborhood')) suburb = suburb || v;
    else if (types.includes('administrative_area_level_2') && !city) city = v;
  }
  return { city, state: normStateName(state), suburb };
}

export async function GET(req: Request) {
  try {
    if (!GOOGLE_PLACES_KEY) {
      return NextResponse.json({ error: 'Google Places API key missing' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const placeId = (searchParams.get('placeId') || '').trim();
    const sessionToken = (searchParams.get('sessionToken') || '').trim();

    if (placeId) {
      const detailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`;
      const detailsRes = await fetch(detailsUrl, {
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
          'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
          ...(sessionToken ? { 'X-Goog-Maps-Session-Token': sessionToken } : {}),
        },
      });
      if (!detailsRes.ok) {
        const msg = await detailsRes.text().catch(() => '');
        return NextResponse.json({ error: `Place details failed: ${detailsRes.status} ${msg}`.trim() }, { status: 502 });
      }
      const details = (await detailsRes.json()) as PlaceDetailsResponse;
      const parts = parseComponents(details.addressComponents || []);
      return NextResponse.json({
        address: details.formattedAddress || '',
        city: parts.city || parts.suburb || 'Nigeria',
        state: parts.state,
        suburb: parts.suburb,
        lat: details.location?.latitude ?? 0,
        lng: details.location?.longitude ?? 0,
      });
    }

    if (q.length < 3) return NextResponse.json({ results: [] });

    const normalizedQ = q.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
    const tokenParts = normalizedQ.split(' ').filter(Boolean);
    const hasShortTrailingToken =
      tokenParts.length >= 2 && tokenParts[tokenParts.length - 1].length > 0 && tokenParts[tokenParts.length - 1].length <= 3;
    const trimmedTrailingQuery = hasShortTrailingToken ? tokenParts.slice(0, -1).join(' ') : '';
    const autocompleteQueries = Array.from(
      new Set(
        [
          normalizedQ,
          normalizedQ.toLowerCase().includes('nigeria') ? normalizedQ : `${normalizedQ}, Nigeria`,
          trimmedTrailingQuery,
          trimmedTrailingQuery
            ? trimmedTrailingQuery.toLowerCase().includes('nigeria')
              ? trimmedTrailingQuery
              : `${trimmedTrailingQuery}, Nigeria`
            : '',
        ].filter(Boolean)
      )
    );

    let suggestions: PlacesNewAutocompleteResponse['suggestions'] = [];
    for (const query of autocompleteQueries) {
      const autoUrl = 'https://places.googleapis.com/v1/places:autocomplete';
      const autoRes = await fetch(autoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text,suggestions.queryPrediction.text.text,suggestions.queryPrediction.structuredFormat.mainText.text,suggestions.queryPrediction.structuredFormat.secondaryText.text',
          ...(sessionToken ? { 'X-Goog-Maps-Session-Token': sessionToken } : {}),
        },
        body: JSON.stringify({
          input: query,
          includeQueryPredictions: true,
          languageCode: 'en',
        }),
      });
      if (!autoRes.ok) continue;
      const data = (await autoRes.json()) as PlacesNewAutocompleteResponse;
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        suggestions = data.suggestions;
        break;
      }
    }

    let results = (suggestions || [])
      .map((s, i) => {
        const place = s.placePrediction;
        const queryPred = s.queryPrediction;
        const label = place?.text?.text || queryPred?.text?.text || '';
        return {
          id: `${place?.placeId || 'q'}-${i}`,
          placeId: place?.placeId || '',
          label,
          mainText: place?.structuredFormat?.mainText?.text || queryPred?.structuredFormat?.mainText?.text || '',
          secondaryText:
            place?.structuredFormat?.secondaryText?.text || queryPred?.structuredFormat?.secondaryText?.text || '',
        };
      })
      .filter((x) => x.label)
      .slice(0, 8);

    if (results.length === 0) {
      const textSearchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName.text,places.formattedAddress',
          ...(sessionToken ? { 'X-Goog-Maps-Session-Token': sessionToken } : {}),
        },
        body: JSON.stringify({
          textQuery: normalizedQ,
          languageCode: 'en',
          pageSize: 8,
        }),
      });
      if (textSearchRes.ok) {
        const textData = (await textSearchRes.json()) as PlacesTextSearchResponse;
        results = (textData.places || [])
          .map((p, i) => ({
            id: `${p.id || 't'}-${i}`,
            placeId: p.id || '',
            label: p.formattedAddress || p.displayName?.text || '',
            mainText: p.displayName?.text || '',
            secondaryText: p.formattedAddress || '',
          }))
          .filter((x) => x.label)
          .slice(0, 8);
      }
    }

    if (results.length === 0) {
      const legacyUrl =
        'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=' +
        encodeURIComponent(normalizedQ) +
        '&language=en&key=' +
        encodeURIComponent(GOOGLE_PLACES_KEY);
      const legacyRes = await fetch(legacyUrl);
      if (legacyRes.ok) {
        const legacy = (await legacyRes.json()) as LegacyPlacesAutocompleteResponse;
        const okStatus = legacy.status === 'OK' || legacy.status === 'ZERO_RESULTS';
        if (okStatus) {
          results = (legacy.predictions || [])
            .map((p, i) => ({
              id: `${p.place_id || 'la'}-${i}`,
              placeId: p.place_id || '',
              label: p.description || '',
              mainText: p.structured_formatting?.main_text || '',
              secondaryText: p.structured_formatting?.secondary_text || '',
            }))
            .filter((x) => x.label)
            .slice(0, 8);
        }
      }
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error('[places]', e);
    return NextResponse.json({ error: 'Places lookup failed' }, { status: 500 });
  }
}

