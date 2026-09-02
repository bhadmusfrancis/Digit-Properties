import { SOCIAL_LINKS } from '@/lib/constants';
import { isVideoUrl } from '@/lib/listing-default-image';
import { isDownloadableListingMedia } from '@/lib/media-download';
import {
  buildListingDetailsLine,
  listingDocToShareFields,
  type ListingShareFields,
} from '@/lib/listing-share-text';
import { getListingPublicPath } from '@/lib/listing-path';
import { siteOrigin } from '@/lib/site-metadata';
import { plainTextExcerpt } from '@/lib/utils';

export type SocialPlatform = 'facebook' | 'twitter' | 'both';

export type SocialPostResult = {
  ok: boolean;
  skipped?: boolean;
  alreadyPosted?: boolean;
  postId?: string;
  url?: string;
  error?: string;
};

export type ListingSocialMedia = {
  photos: string[];
  videos: string[];
};

const FACEBOOK_PHOTO_LIMIT = 10;
const TWITTER_PHOTO_LIMIT = 4;
const TWITTER_URL_LENGTH = 23;

export function getSocialPostConfig(): { facebook: boolean; twitter: boolean } {
  return {
    facebook: Boolean(
      process.env.FACEBOOK_PAGE_ID?.trim() && process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim()
    ),
    twitter: Boolean(
      process.env.TWITTER_API_KEY?.trim() &&
        process.env.TWITTER_API_SECRET?.trim() &&
        process.env.TWITTER_ACCESS_TOKEN?.trim() &&
        process.env.TWITTER_ACCESS_TOKEN_SECRET?.trim()
    ),
  };
}

export function collectListingSocialMedia(listing: {
  images?: { url?: string; public_id?: string }[] | null;
  videos?: { url?: string; public_id?: string }[] | null;
}): ListingSocialMedia {
  const photos: string[] = [];
  const videos: string[] = [];
  const seen = new Set<string>();

  const push = (url: string | undefined, publicId: string | undefined, treatAsVideo: boolean) => {
    const u = typeof url === 'string' ? url.trim() : '';
    if (!u.startsWith('http') || seen.has(u)) return;
    if (!isDownloadableListingMedia(u, publicId)) return;
    seen.add(u);
    if (treatAsVideo || isVideoUrl(u)) videos.push(u);
    else photos.push(u);
  };

  for (const img of listing.images ?? []) {
    push(img?.url, img?.public_id, Boolean(img?.url && isVideoUrl(img.url)));
  }
  for (const video of listing.videos ?? []) {
    push(video?.url, video?.public_id, true);
  }
  return { photos, videos };
}

export function listingPublicUrl(listing: {
  _id?: string | { toString(): string };
  slug?: string | null;
}): string {
  return `${siteOrigin()}${getListingPublicPath(listing)}`;
}

export function facebookPostUrl(postId: string): string {
  const id = postId.trim();
  if (!id) return SOCIAL_LINKS.FACEBOOK;
  if (id.includes('_')) return `https://www.facebook.com/${id.replace('_', '/posts/')}`;
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  if (pageId) return `https://www.facebook.com/${pageId}/posts/${id}`;
  return `https://www.facebook.com/${id}`;
}

export function twitterPostUrl(postId: string): string {
  const id = postId.trim();
  if (!id) return SOCIAL_LINKS.TWITTER;
  return `https://x.com/i/web/status/${id}`;
}

export function buildFacebookCaption(fields: ListingShareFields, listingUrl: string): string {
  const title = fields.title.trim();
  const details = buildListingDetailsLine(fields);
  const excerpt = plainTextExcerpt(fields.description, 420, '');
  const excerptUse =
    excerpt && excerpt.trim().toLowerCase() !== title.toLowerCase() ? excerpt.trim() : '';
  return [title, details, excerptUse, `View listing: ${listingUrl}`, '#DigitProperties']
    .filter(Boolean)
    .join('\n\n');
}

export function buildTwitterText(fields: ListingShareFields, listingUrl: string): string {
  const title = fields.title.trim();
  const details = buildListingDetailsLine(fields);
  const reserved = TWITTER_URL_LENGTH + 1;
  const max = 280 - reserved;
  let head = title;
  if (details) {
    const withDetails = `${title}\n${details}`;
    if (withDetails.length <= max) head = withDetails;
  }
  if (head.length > max) head = `${head.slice(0, Math.max(0, max - 1))}…`;
  return `${head}\n${listingUrl}`;
}

export function facebookMediaPlan(media: ListingSocialMedia): {
  photos: string[];
  video?: string;
} {
  if (media.photos.length) return { photos: media.photos.slice(0, FACEBOOK_PHOTO_LIMIT) };
  if (media.videos.length) return { photos: [], video: media.videos[0] };
  return { photos: [] };
}

export function twitterMediaPlan(media: ListingSocialMedia): {
  photos: string[];
  video?: string;
} {
  if (media.photos.length) return { photos: media.photos.slice(0, TWITTER_PHOTO_LIMIT) };
  if (media.videos.length) return { photos: [], video: media.videos[0] };
  return { photos: [] };
}

export function listingToShareFields(listing: Parameters<typeof listingDocToShareFields>[0]): ListingShareFields {
  return listingDocToShareFields(listing);
}

/** Insert a Cloudinary transformation so Twitter downloads a reasonably sized JPEG. */
export function withCloudinaryTwitterImage(url: string): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  if (/\/image\/upload\/[^/]*w_\d+/.test(url)) return url;
  return url.replace('/image/upload/', '/image/upload/w_1600,c_limit,q_auto:good,f_jpg/');
}
