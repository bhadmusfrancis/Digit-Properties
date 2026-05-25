import { NIGERIAN_STATES } from '@/lib/constants';

/** Approximate bounding box for Nigeria (mainland + margins). */
export const NIGERIA_BOUNDS = {
  minLat: 4.0,
  maxLat: 14.2,
  minLng: 2.5,
  maxLng: 14.8,
};

const NIGERIAN_STATE_SET = new Set(NIGERIAN_STATES.map((s) => s.toLowerCase()));

/** Country / region names that indicate a non-Nigeria address when present without Nigeria context. */
const FOREIGN_LOCATION_MARKERS = [
  'united states',
  'usa',
  ', us',
  ' u.s.',
  'united kingdom',
  ', uk',
  'england',
  'scotland',
  'wales',
  'canada',
  'australia',
  'dubai',
  'uae',
  'india',
  'china',
  'germany',
  'france',
  'italy',
  'spain',
  'netherlands',
  'south africa',
  'kenya',
  'ghana',
  'togo',
  'benin republic',
  'cameroon',
  'niger republic',
  'chad',
  'senegal',
  'london,',
  'paris,',
  'new york',
  'los angeles',
  'toronto',
  'mumbai',
  'beijing',
  'singapore',
  'hong kong',
];

function normalizeLocText(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isNigeriaInText(text: string): boolean {
  const t = normalizeLocText(text);
  return t.includes('nigeria') || t.includes(' ng') || t.endsWith(' ng');
}

export function hasForeignLocationMarker(text: string): boolean {
  const t = normalizeLocText(text);
  if (!t) return false;
  if (isNigeriaInText(t)) return false;
  return FOREIGN_LOCATION_MARKERS.some((m) => t.includes(m));
}

export function isCoordinatesInNigeria(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  if (lat === 0 && lng === 0) return true;
  return (
    lat >= NIGERIA_BOUNDS.minLat &&
    lat <= NIGERIA_BOUNDS.maxLat &&
    lng >= NIGERIA_BOUNDS.minLng &&
    lng <= NIGERIA_BOUNDS.maxLng
  );
}

export function isKnownNigerianState(state: string): boolean {
  const s = (state || '').trim();
  if (!s) return false;
  if (s.toLowerCase() === 'federal capital territory') return true;
  return NIGERIAN_STATE_SET.has(s.toLowerCase());
}

export type LocationLike = {
  address?: string;
  city?: string;
  state?: string;
  suburb?: string;
  coordinates?: { lat?: number; lng?: number };
};

export function assessNigeriaLocation(location: LocationLike): { inNigeria: boolean; reason?: string } {
  const parts = [location.address, location.city, location.suburb, location.state].filter(Boolean).join(', ');
  const combined = normalizeLocText(parts);

  if (hasForeignLocationMarker(combined)) {
    return { inNigeria: false, reason: 'Address appears to be outside Nigeria' };
  }

  const state = (location.state || '').trim();
  if (state && !isKnownNigerianState(state)) {
    return { inNigeria: false, reason: 'State is not a recognized Nigerian state' };
  }

  const lat = location.coordinates?.lat;
  const lng = location.coordinates?.lng;
  if (lat != null && lng != null && !isCoordinatesInNigeria(lat, lng)) {
    return { inNigeria: false, reason: 'Map coordinates are outside Nigeria' };
  }

  if (combined && !isNigeriaInText(combined) && state && !isKnownNigerianState(state)) {
    return { inNigeria: false, reason: 'Location could not be verified as Nigeria' };
  }

  return { inNigeria: true };
}

export function filterLocationsToNigeria<T extends LocationLike>(results: T[]): T[] {
  return results.filter((r) => assessNigeriaLocation(r).inNigeria);
}

/** Prefer Nigeria-labelled suggestions when sorting address autocomplete. */
export function nigeriaLocationSortScore(label: string, secondary = ''): number {
  const text = normalizeLocText(`${label} ${secondary}`);
  let score = 0;
  if (isNigeriaInText(text)) score += 100;
  if (text.includes('lagos')) score += 20;
  if (text.includes('abuja') || text.includes('fct')) score += 15;
  if (hasForeignLocationMarker(text)) score -= 200;
  return score;
}
