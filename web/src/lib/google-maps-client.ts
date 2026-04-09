'use client';

const GOOGLE_MAPS_API = 'https://maps.googleapis.com/maps/api/js';

let mapsScriptPromise: Promise<void> | null = null;

export function loadGoogleMapsApi(apiKey: string, libraries: string[] = []): Promise<void> {
  const g = globalThis as typeof globalThis & {
    google?: { maps?: { Map?: unknown; places?: unknown } };
  };
  if (g.google?.maps?.Map) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  const libs = Array.from(new Set(libraries.filter(Boolean))).join(',');
  mapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `${GOOGLE_MAPS_API}?key=${encodeURIComponent(apiKey)}${libs ? `&libraries=${encodeURIComponent(libs)}` : ''}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return mapsScriptPromise;
}

