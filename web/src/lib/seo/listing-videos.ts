import {
  getCloudinaryVideoThumbnailUrl,
  isVideoUrl,
  type ListingVideoRef,
} from '@/lib/listing-default-image';
import { siteOrigin } from '@/lib/site-metadata';

export type ListingGalleryVideo = {
  url: string;
  public_id?: string;
};

/** Collect playable videos from listing `videos` and legacy video URLs stored in `images`. */
export function collectListingGalleryVideos(
  images: { url?: string; public_id?: string }[] | undefined,
  videos: ListingVideoRef[] | undefined
): ListingGalleryVideo[] {
  const out: ListingGalleryVideo[] = [];
  const seen = new Set<string>();

  const push = (item: ListingGalleryVideo) => {
    const key = item.url.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ url: key, public_id: item.public_id });
  };

  for (const v of videos ?? []) {
    const url = typeof v?.url === 'string' ? v.url.trim() : '';
    if (!url) continue;
    push({
      url,
      public_id: v.public_id != null ? String(v.public_id) : undefined,
    });
  }

  for (const img of images ?? []) {
    const url = typeof img?.url === 'string' ? img.url.trim() : '';
    if (!url || !isVideoUrl(url)) continue;
    push({
      url,
      public_id: img.public_id != null ? String(img.public_id) : undefined,
    });
  }

  return out;
}

export type ListingVideoSeoInput = {
  title: string;
  description: string;
  pagePath: string;
  uploadDate?: string;
  videos: ListingGalleryVideo[];
};

export type ListingVideoSeoItem = {
  contentUrl: string;
  thumbnailUrl: string;
  name: string;
  description: string;
  uploadDate: string;
  /** Public watch page where the video is the primary content (Google video indexing). */
  embedUrl: string;
  watchPagePath: string;
};

function normalizeListingPagePath(pagePath: string): string {
  return pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
}

/** Dedicated watch page path for a listing gallery video (1-based index in the URL). */
export function getListingVideoWatchPath(pagePath: string, videoIndex: number): string {
  const base = normalizeListingPagePath(pagePath);
  return `${base}/video/${videoIndex + 1}`;
}

function ensureHttpsUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return `https://${u.replace(/^\/\//, '')}`;
}

/** Normalize delivery URL for crawlers (HTTPS, direct file when possible). */
export function normalizeVideoContentUrl(url: string): string {
  const https = ensureHttpsUrl(url);
  if (!https.includes('res.cloudinary.com') || !https.includes('/video/upload/')) {
    return https;
  }

  // If the URL already has a file extension, keep it (don't force .mp4).
  // If it doesn't, append .mp4 so crawlers have a concrete file URL.
  const [path, queryAndHash] = https.split(/[\?#]/);
  const hasAnyExtension = /\.[a-z0-9]{2,10}$/i.test(path);
  const normalizedPath = hasAnyExtension ? path : `${path}.mp4`;
  return queryAndHash ? `${normalizedPath}?${queryAndHash}` : normalizedPath;
}

export function buildListingVideoSeoItems(input: ListingVideoSeoInput): ListingVideoSeoItem[] {
  const origin = siteOrigin();
  const pagePath = normalizeListingPagePath(input.pagePath);
  const baseTitle = input.title.trim() || 'Property listing video';
  const baseDescription = input.description.trim().slice(0, 2048) || baseTitle;
  const uploadDate = input.uploadDate ?? new Date().toISOString();

  return input.videos.map((video, index) => {
    const contentUrl = normalizeVideoContentUrl(video.url);
    const thumb =
      getCloudinaryVideoThumbnailUrl(video) ??
      `${origin}/images/default-listing/apartment.svg`;
    const suffix = input.videos.length > 1 ? ` (${index + 1})` : '';
    const watchPagePath = getListingVideoWatchPath(pagePath, index);
    const embedUrl = `${origin}${watchPagePath}`;
    return {
      contentUrl,
      thumbnailUrl: ensureHttpsUrl(thumb),
      name: `${baseTitle}${suffix}`,
      description: baseDescription,
      uploadDate,
      embedUrl,
      watchPagePath,
    };
  });
}
