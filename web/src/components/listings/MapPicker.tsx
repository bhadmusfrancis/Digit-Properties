'use client';

import { useEffect, useRef } from 'react';
import { loadGoogleMapsApi } from '@/lib/google-maps-client';

const DEFAULT_LAT = 6.5244;
const DEFAULT_LNG = 3.3792;
/** Zoom level when centering on a resolved address or saved listing coordinates */
const LOCATION_FOCUS_ZOOM = 15;

type GoogleMapsGlobal = typeof globalThis & {
  google?: {
    maps?: {
      Map: new (el: HTMLElement, opts: Record<string, unknown>) => {
        setCenter: (latLng: { lat: number; lng: number }) => void;
        setZoom: (zoom: number) => void;
      };
      Marker: new (opts: {
        map: unknown;
        position: { lat: number; lng: number };
        draggable?: boolean;
      }) => {
        setPosition: (pos: { lat: number; lng: number }) => void;
      };
      event: {
        clearInstanceListeners: (instance: unknown) => void;
      };
    };
  };
};

export function MapPicker({
  initialLat,
  initialLng,
  onPick,
  /** When false, map marker/view is not moved when form coordinates change (manual pin lock). */
  followFormCoordinates = true,
}: {
  initialLat?: number;
  initialLng?: number;
  onPick: (lat: number, lng: number) => void;
  followFormCoordinates?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{
    setCenter: (latLng: { lat: number; lng: number }) => void;
    setZoom: (zoom: number) => void;
  } | null>(null);
  const markerRef = useRef<{ setPosition: (pos: { lat: number; lng: number }) => void } | null>(null);
  const nativeMapRef = useRef<unknown>(null);
  const nativeMarkerRef = useRef<unknown>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Keep refs in sync so async map init and sync update effect both see latest position
  const latRef = useRef(initialLat ?? DEFAULT_LAT);
  const lngRef = useRef(initialLng ?? DEFAULT_LNG);
  latRef.current = initialLat ?? DEFAULT_LAT;
  lngRef.current = initialLng ?? DEFAULT_LNG;

  // Create map once on mount. Use refs for position so we show latest coords even if they arrived before map was ready.
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) return;

    let cancelled = false;
    loadGoogleMapsApi(apiKey)
      .then(() => {
        const g = globalThis as GoogleMapsGlobal;
        const maps = g.google?.maps;
        if (cancelled || !containerRef.current || !maps) return;

        const lat = latRef.current;
        const lng = lngRef.current;
        const center = { lat, lng };
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: LOCATION_FOCUS_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const marker = new maps.Marker({
          map,
          position: center,
          draggable: false,
        });

        nativeMapRef.current = map;
        nativeMarkerRef.current = marker;
        mapRef.current = map;
        markerRef.current = marker;

        const clickableMap = map as unknown as {
          addListener?: (
            eventName: string,
            cb: (e: { latLng?: { lat: () => number; lng: () => number } }) => void
          ) => void;
        };
        clickableMap.addListener?.('click', (e) => {
          const latLng = e?.latLng;
          if (!latLng) return;
          const newLat = latLng.lat();
          const newLng = latLng.lng();
          marker.setPosition({ lat: newLat, lng: newLng });
          onPickRef.current(newLat, newLng);
        });
      })
      .catch(() => {
        // Silent fallback: keep empty map frame if script fails
      });

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current = null;
      const maps = (globalThis as GoogleMapsGlobal).google?.maps;
      if (maps && nativeMarkerRef.current) {
        maps.event.clearInstanceListeners(nativeMarkerRef.current);
      }
      if (maps && nativeMapRef.current) {
        maps.event.clearInstanceListeners(nativeMapRef.current);
      }
      nativeMarkerRef.current = null;
      nativeMapRef.current = null;
    };
  }, []);

  // When initialLat/initialLng change (geocode, edit load, suggestion), center map and marker on that point
  useEffect(() => {
    if (!followFormCoordinates) return;
    const lat = initialLat ?? DEFAULT_LAT;
    const lng = initialLng ?? DEFAULT_LNG;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const map = mapRef.current;
    const marker = markerRef.current;
    if (map && marker) {
      marker.setPosition({ lat, lng });
      map.setCenter({ lat, lng });
      map.setZoom(LOCATION_FOCUS_ZOOM);
    }
  }, [initialLat, initialLng, followFormCoordinates]);

  const hasMapsKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
  return (
    <>
      <div
        ref={containerRef}
        className="h-64 w-full rounded border border-gray-200 bg-gray-100"
        style={{ minHeight: 256 }}
      />
      {!hasMapsKey ? (
        <p className="mt-2 text-xs text-amber-700">
          Map unavailable: set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in environment variables.
        </p>
      ) : null}
    </>
  );
}
