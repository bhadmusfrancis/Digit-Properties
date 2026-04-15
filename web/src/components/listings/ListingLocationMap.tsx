'use client';

type Coords = { lat: number; lng: number };

type ListingLocationMapProps = {
  /** Optional, kept for backward compatibility with existing callers. */
  mapsApiKey?: string;
  /** Human-readable address for directions when coordinates are missing. */
  addressLine: string;
  coordinates?: Coords | null;
};

export function ListingLocationMap({ addressLine, coordinates }: ListingLocationMapProps) {
  const destinationQuery = coordinates ? `${coordinates.lat},${coordinates.lng}` : addressLine;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`;
  const streetViewTabUrl = coordinates
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coordinates.lat},${coordinates.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`;

  // Use public Google Maps embed URLs (no API key required) so listing page maps
  // still render when Maps Embed API is not enabled for the project.
  const mapEmbedUrl = coordinates
    ? `https://maps.google.com/maps?q=${coordinates.lat},${coordinates.lng}&z=15&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(addressLine)}&z=15&output=embed`;

  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <h4 className="text-sm font-semibold text-gray-900">Map & directions</h4>
      <div className="flex flex-wrap gap-2">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Open directions
        </a>
        <a
          href={streetViewTabUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          {coordinates ? 'Street View (Google Maps)' : 'View on map'}
        </a>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
        <iframe
          title="Property location map"
          className="aspect-video h-[220px] w-full sm:h-[280px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          src={mapEmbedUrl}
        />
      </div>
    </div>
  );
}
