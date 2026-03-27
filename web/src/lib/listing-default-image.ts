/**
 * Default SEO/placeholder images for listings when the user did not upload images.
 * One image per property type, used in cards, detail gallery, and og:image.
 */
const DEFAULT_IMAGE_DIR = '/images/default-listing';

const CLOUDINARY_HOST = 'res.cloudinary.com';

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
 * Extract Cloudinary video `public_id` from a video delivery URL.
 * e.g. .../video/upload/v123/folder/id.mp4 → folder/id
 */
function extractCloudinaryVideoPublicIdFromUrl(url: string): string | null {
  try {
    const m = url.match(/\/video\/upload\/(?:v\d+\/)?([^?#]+)/i);
    if (!m?.[1]) return null;
    let path = decodeURIComponent(m[1]);
    path = path.replace(/\.(mp4|webm|mov|mkv|avi|m4v)$/i, '');
    return path || null;
  } catch {
    return null;
  }
}

/**
 * JPG thumbnail (first frame) for a Cloudinary-hosted video. Non-Cloudinary URLs return null.
 */
export function getCloudinaryVideoThumbnailUrl(
  video: { url?: string; public_id?: string }
): string | null {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud) return null;

  let publicId = typeof video.public_id === 'string' ? video.public_id.trim() : '';
  if (!publicId && video.url?.includes(CLOUDINARY_HOST) && video.url.includes('/video/upload/')) {
    publicId = extractCloudinaryVideoPublicIdFromUrl(video.url) ?? '';
  }
  if (!publicId) return null;

  return `https://${CLOUDINARY_HOST}/${cloud}/video/upload/so_0,f_jpg,q_auto/${publicId}`;
}

export type ListingVideoRef = { url?: string; public_id?: string };

/**
 * Card / preview image: first photo, else first Cloudinary video frame, else default by property type.
 */
export function getListingDisplayImage(
  images: { url?: string }[] | undefined,
  propertyType: string,
  videos?: ListingVideoRef[] | undefined
): string {
  const firstImg = images?.find((i) => i?.url?.trim())?.url;
  if (firstImg) return firstImg;
  const firstVid = videos?.find((v) => v?.url?.trim() || v?.public_id?.trim());
  if (firstVid) {
    const thumb = getCloudinaryVideoThumbnailUrl(firstVid);
    if (thumb) return thumb;
  }
  return getDefaultListingImageUrl(propertyType);
}

/**
 * Gallery images: listing photos, or a single video frame thumbnail when there are only videos, else default placeholder.
 */
export function getListingImagesForDisplay(
  images: { url: string; public_id?: string }[] | undefined,
  propertyType: string,
  videos?: ListingVideoRef[] | undefined
): { url: string; public_id?: string }[] {
  const list = images?.filter((img) => img?.url) ?? [];
  if (list.length > 0) return list;
  const firstVid = videos?.find((v) => v?.url?.trim() || v?.public_id?.trim());
  if (firstVid) {
    const thumb = getCloudinaryVideoThumbnailUrl(firstVid);
    if (thumb) {
      return [
        {
          url: thumb,
          public_id: firstVid.public_id ? `${firstVid.public_id}__thumb` : 'video-thumb',
        },
      ];
    }
  }
  return [{ url: getDefaultListingImageUrl(propertyType), public_id: `default-${propertyType}` }];
}
