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
function extractCloudinaryCloudNameFromUrl(url: string): string | null {
  const m = url.match(/\/\/res\.cloudinary\.com\/([^/]+)\//i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

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
  let publicId = typeof video.public_id === 'string' ? video.public_id.trim() : '';
  const url = typeof video.url === 'string' ? video.url.trim() : '';
  if (!publicId && url.includes(CLOUDINARY_HOST) && url.includes('/video/upload/')) {
    publicId = extractCloudinaryVideoPublicIdFromUrl(url) ?? '';
  }
  if (!publicId) return null;

  const cloud =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || (url ? extractCloudinaryCloudNameFromUrl(url) : null);
  if (!cloud) return null;

  // so_0 = first frame; c_limit,w_1920 aligns with listing image uploads; g_auto centers the crop when used with fill elsewhere
  return `https://${CLOUDINARY_HOST}/${cloud}/video/upload/so_0,f_jpg,q_auto,c_limit,w_1920/${publicId}`;
}

export type ListingVideoRef = { url?: string; public_id?: string };

function isVideoUrl(url: string): boolean {
  const clean = (url || '').split('?')[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v|ogg|ogv|mkv|avi)$/.test(clean) || clean.includes('/video/upload/');
}

/**
 * True when listing has video media (including legacy records where video URLs were saved in images[]).
 */
export function listingHasVideoMedia(
  images?: { url?: string }[] | undefined,
  videos?: ListingVideoRef[] | undefined
): boolean {
  const fromVideos = (videos ?? []).some((v) => !!(v?.url?.trim() || v?.public_id?.trim()));
  if (fromVideos) return true;
  return (images ?? []).some((img) => !!img?.url && isVideoUrl(img.url));
}

/** Photo vs video counts (includes legacy video URLs stored in `images`). */
export function countListingGalleryItems(
  images?: { url?: string }[] | undefined,
  videos?: ListingVideoRef[] | undefined
): { photos: number; videos: number } {
  const imgList = images ?? [];
  const vidList = videos ?? [];
  const photos = imgList.filter((i) => i?.url?.trim() && !isVideoUrl(i.url || '')).length;
  const videosCount =
    vidList.filter((v) => v?.url?.trim() || v?.public_id?.trim()).length +
    imgList.filter((i) => i?.url?.trim() && isVideoUrl(i.url || '')).length;
  return { photos, videos: videosCount };
}

function toAbsoluteOgUrl(baseUrl: string, raw: string): string {
  const u = (raw || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const base = baseUrl.replace(/\/$/, '');
  return `${base}${u.startsWith('/') ? u : `/${u}`}`;
}

/**
 * Open Graph / Twitter images: primary preview plus extra listing photos (carousel on some platforms).
 */
export function getListingOpenGraphImages(
  baseUrl: string,
  images: { url?: string }[] | undefined,
  propertyType: string,
  videos: ListingVideoRef[] | undefined,
  alt: string,
  maxImages = 4
): { url: string; width: number; height: number; alt: string }[] {
  const primaryRaw = getListingDisplayImage(images, propertyType, videos);
  const out: { url: string; width: number; height: number; alt: string }[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const abs = toAbsoluteOgUrl(baseUrl, raw);
    if (!abs || seen.has(abs)) return;
    seen.add(abs);
    out.push({ url: abs, width: 1200, height: 630, alt });
  };

  push(primaryRaw);

  for (const img of images ?? []) {
    const u = typeof img?.url === 'string' ? img.url.trim() : '';
    if (!u || isVideoUrl(u)) continue;
    push(u);
    if (out.length >= maxImages) break;
  }

  return out;
}

/**
 * Card / preview image: first real photo wins; if the listing is video-only (no stills), use a Cloudinary video frame.
 */
export function getListingDisplayImage(
  images: { url?: string }[] | undefined,
  propertyType: string,
  videos?: ListingVideoRef[] | undefined
): string {
  const firstStill = images?.find((i) => i?.url?.trim() && !isVideoUrl(i.url || ''))?.url;
  if (firstStill) return firstStill;

  const firstVid =
    videos?.find((v) => v?.url?.trim() || v?.public_id?.trim()) ??
    images
      ?.filter((i) => i?.url?.trim())
      .map((i) => ({ url: i.url }))
      .find((i) => i.url && isVideoUrl(i.url));
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
