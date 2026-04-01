'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_LAT = 6.5244;
const DEFAULT_LNG = 3.3792;
/** Zoom level when centering on a resolved address or saved listing coordinates */
const LOCATION_FOCUS_ZOOM = 15;

/** Leaflet may be default export or namespace depending on bundler. */
function getL(leaflet: typeof import('leaflet') | { default: typeof import('leaflet') }) {
  return (leaflet as { default?: typeof import('leaflet') }).default ?? (leaflet as typeof import('leaflet'));
}

/** Distinct map marker: teal pin (Leaflet default icon often broken in bundlers). */
function createMarkerIcon(leaflet: typeof import('leaflet') | { default: typeof import('leaflet') }) {
  const L = getL(leaflet);
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:28px;height:36px;position:relative;">
      <svg viewBox="0 0 24 36" style="width:100%;height:100%;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
        <path fill="#0d9488" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>
        <circle cx="12" cy="12" r="5" fill="#fff"/>
      </svg>
    </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

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
  const mapRef = useRef<ReturnType<typeof import('leaflet').map> | null>(null);
  const markerRef = useRef<ReturnType<typeof import('leaflet').marker> | null>(null);
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

    let cancelled = false;
    import('leaflet').then((leaflet) => {
      const L = getL(leaflet);
      if (cancelled || !containerRef.current) return;
      const lat = latRef.current;
      const lng = lngRef.current;
      const map = L.map(containerRef.current).setView([lat, lng], LOCATION_FOCUS_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      const marker = L.marker([lat, lng], { icon: createMarkerIcon(leaflet) }).addTo(map);

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const { lat: newLat, lng: newLng } = e.latlng;
        marker.setLatLng([newLat, newLng]);
        onPickRef.current(newLat, newLng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      // If coords changed while we were loading, update now
      const currentLat = latRef.current;
      const currentLng = lngRef.current;
      if (currentLat !== lat || currentLng !== lng) {
        marker.setLatLng([currentLat, currentLng]);
        map.setView([currentLat, currentLng], LOCATION_FOCUS_ZOOM);
      }
    });

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
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
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], LOCATION_FOCUS_ZOOM);
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    }
  }, [initialLat, initialLng, followFormCoordinates]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded border border-gray-200 bg-gray-100"
      style={{ minHeight: 256 }}
    />
  );
}
