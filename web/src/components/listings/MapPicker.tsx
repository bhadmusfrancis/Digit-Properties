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
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    const lat = initialLat ?? DEFAULT_LAT;
    const lng = initialLng ?? DEFAULT_LNG;

    let L: typeof import('leaflet');
    import('leaflet').then((leaflet) => {
      L = leaflet.default;
      if (!containerRef.current) return;
      const map = L.map(containerRef.current).setView([lat, lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      let marker = L.marker([lat, lng]).addTo(map);

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const { lat: newLat, lng: newLng } = e.latlng;
        marker.setLatLng([newLat, newLng]);
        onPick(newLat, newLng);
      });

      mapRef.current = {
        remove() {
          map.remove();
        },
      };
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initialLat, initialLng, onPick]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded border border-gray-200 bg-gray-100"
      style={{ minHeight: 256 }}
    />
  );
}
