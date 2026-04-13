'use client';

type Coords = { lat: number; lng: number };

type ListingLocationMapProps = {
  /** Maps Embed API key (same as map picker). Optional: links still work without it. */
  mapsApiKey?: string;
  /** Human-readable address for directions when coordinates are missing. */
  addressLine: string;
  coordinates?: Coords | null;
};

export function ListingLocationMap({ mapsApiKey, addressLine, coordinates }: ListingLocationMapProps) {
  const destinationQuery = coordinates ? `${coordinates.lat},${coordinates.lng}` : addressLine;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`;
  const streetViewTabUrl = coordinates
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coordinates.lat},${coordinates.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`;

  const streetViewEmbedUrl =
    mapsApiKey && coordinates
      ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(mapsApiKey)}&location=${coordinates.lat},${coordinates.lng}&heading=210&pitch=5&fov=85`
      : null;

  const placeEmbedUrl =
    mapsApiKey && !coordinates
      ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsApiKey)}&q=${encodeURIComponent(addressLine)}`
      : null;

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
      {streetViewEmbedUrl && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          <iframe
            title="Street View"
            className="aspect-video h-[220px] w-full sm:h-[280px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            src={streetViewEmbedUrl}
          />
        </div>
      )}
      {placeEmbedUrl && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          <iframe
            title="Property location"
            className="aspect-video h-[220px] w-full sm:h-[280px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            src={placeEmbedUrl}
          />
        </div>
      )}
      {!streetViewEmbedUrl && !placeEmbedUrl && (
        <p className="text-xs text-gray-500">
          Saved map coordinates unlock an embedded street preview here. Directions and Google Maps still open from the address
          above.
        </p>
      )}
    </div>
  );
}
