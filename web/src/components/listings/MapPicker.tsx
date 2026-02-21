'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_LAT = 6.5244;
const DEFAULT_LNG = 3.3792;

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
}: {
  initialLat?: number;
  initialLng?: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<typeof import('leaflet').map> | null>(null);
  const markerRef = useRef<ReturnType<typeof import('leaflet').marker> | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Create map once on mount; avoid re-running when initialLat/initialLng/onPick change (which would destroy and recreate the map).
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    const lat = initialLat ?? DEFAULT_LAT;
    const lng = initialLng ?? DEFAULT_LNG;

    let cancelled = false;
    import('leaflet').then((leaflet) => {
      const L = getL(leaflet);
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current).setView([lat, lng], 14);
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
    });

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // When initialLat/initialLng change (e.g. form updated after pick or editing existing listing), update marker and view without destroying the map.
  useEffect(() => {
    const lat = initialLat ?? DEFAULT_LAT;
    const lng = initialLng ?? DEFAULT_LNG;
    const map = mapRef.current;
    const marker = markerRef.current;
    if (map && marker) {
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], map.getZoom());
    }
  }, [initialLat, initialLng]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded border border-gray-200 bg-gray-100"
      style={{ minHeight: 256 }}
    />
  );
}
