/**
 * Default SEO/placeholder images for listings when the user did not upload images.
 * One image per property type, used in cards, detail gallery, and og:image.
 */
const DEFAULT_IMAGE_DIR = '/images/default-listing';

/** Property type to filename (no extension - we use .svg for placeholders, .webp when we have generated assets). */
const PROPERTY_TYPE_TO_FILENAME: Record<string, string> = {
  apartment: 'apartment',
  bungalow: 'bungalow',
  house: 'house',
  land: 'land',
  commercial: 'commercial',
  duplex: 'duplex',
  penthouse: 'penthouse',
  studio: 'studio',
  terrace: 'terrace',
  villa: 'villa',
  warehouse: 'warehouse',
  farm: 'farm',
  factory: 'factory',
  // New types map to closest existing placeholder asset
  maisonette: 'duplex',
  hotel: 'commercial',
  industrial: 'factory',
  office: 'commercial',
  mixed_use: 'commercial',
  event_center: 'commercial',
  shop: 'commercial',
  semi_detached: 'house',
  mini_flat: 'apartment',
  townhouse: 'terrace',
};

/**
 * Returns the default listing image URL for a property type.
 * Use when listing has no images (cards, gallery, og:image).
 */
export function getDefaultListingImageUrl(propertyType: string): string {
  const normalized = (propertyType || 'apartment').toLowerCase();
  const filename = PROPERTY_TYPE_TO_FILENAME[normalized] ?? 'apartment';
  return `${DEFAULT_IMAGE_DIR}/${filename}.svg`;
}

/**
 * Returns whether the given URL is a default placeholder (not user-uploaded).
 */
export function isDefaultListingImageUrl(url: string): boolean {
  return url.startsWith(DEFAULT_IMAGE_DIR);
}

/**
 * First image to use for a listing: listing's first image or default by property type.
 */
export function getListingDisplayImage(
  images: { url: string }[] | undefined,
  propertyType: string
): string {
  const first = images?.[0]?.url;
  if (first) return first;
  return getDefaultListingImageUrl(propertyType);
}

/**
 * Image list for gallery: use listing images, or a single default image when none.
 */
export function getListingImagesForDisplay(
  images: { url: string; public_id?: string }[] | undefined,
  propertyType: string
): { url: string; public_id?: string }[] {
  const list = images?.filter((img) => img?.url) ?? [];
  if (list.length > 0) return list;
  return [{ url: getDefaultListingImageUrl(propertyType), public_id: `default-${propertyType}` }];
}
