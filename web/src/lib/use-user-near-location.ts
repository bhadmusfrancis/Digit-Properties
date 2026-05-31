'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NearLocationParams } from '@/lib/listing-proximity-sort';

const CACHE_KEY = 'dp-user-near-location';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedNearLocation = NearLocationParams & { cachedAt: number };

function readCachedNearLocation(): NearLocationParams | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedNearLocation;
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    const { suburb, city, state } = parsed;
    if (!suburb && !city && !state) return null;
    return { suburb, city, state };
  } catch {
    return null;
  }
}

function writeCachedNearLocation(location: NearLocationParams) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...location, cachedAt: Date.now() }));
  } catch {
    /* ignore quota errors */
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<NearLocationParams | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'Digit-Properties-Web/1.0' } }
    );
    const data = (await res.json()) as {
      address?: {
        suburb?: string;
        neighbourhood?: string;
        city?: string;
        town?: string;
        state?: string;
        county?: string;
      };
    };
    const a = data?.address;
    if (!a) return null;
    const suburb = a.suburb ?? a.neighbourhood ?? '';
    const city = a.city ?? a.town ?? a.county ?? '';
    const state = a.state ?? '';
    if (!suburb && !city && !state) return null;
    return { suburb: suburb || undefined, city: city || undefined, state: state || undefined };
  } catch {
    return null;
  }
}

export type UserNearLocationStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export function useUserNearLocation(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const [location, setLocation] = useState<NearLocationParams | null>(null);
  const [status, setStatus] = useState<UserNearLocationStatus>('idle');

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      return;
    }

    const cached = readCachedNearLocation();
    if (cached) {
      setLocation(cached);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        reverseGeocode(pos.coords.latitude, pos.coords.longitude).then((resolved) => {
          if (resolved) {
            writeCachedNearLocation(resolved);
            setLocation(resolved);
            setStatus('ready');
          } else {
            setStatus('unavailable');
          }
        });
      },
      () => setStatus('unavailable'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: CACHE_TTL_MS }
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const cached = readCachedNearLocation();
    if (cached) {
      setLocation(cached);
      setStatus('ready');
    }
  }, [enabled]);

  return { location, status, requestLocation };
}
