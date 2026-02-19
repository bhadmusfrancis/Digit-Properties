'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_LAT = 6.5244;
const DEFAULT_LNG = 3.3792;

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
      const L = leaflet.default;
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current).setView([lat, lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      const marker = L.marker([lat, lng]).addTo(map);

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
