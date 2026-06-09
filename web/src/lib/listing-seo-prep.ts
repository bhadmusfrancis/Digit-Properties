import { isVideoUrl } from '@/lib/listing-default-image';
import { dedupeImagesByPublicId } from '@/lib/listing-dedupe';
import { mergeUniqueLists, normalizeList } from '@/lib/listing-amenities';
import {
  buildListingShareDescription,
  listingDocToShareFields,
  type ListingShareFields,
} from '@/lib/listing-share-text';

export const WHATSAPP_CHAT_IMPORT_TAG = 'whatsapp-chat-import';
export const WHATSAPP_IMPORT_TAG = 'whatsapp-import';

export type ListingMediaRecord = { url: string; public_id: string };

const MIN_SEO_DESCRIPTION_LEN = 80;

function toMediaRecord(item: { url?: string; public_id?: string }): ListingMediaRecord | null {
  const url = typeof item?.url === 'string' ? item.url.trim() : '';
  const public_id = typeof item?.public_id === 'string' ? item.public_id.trim() : '';
  if (!url || !public_id) return null;
  return { url, public_id };
}

/**
 * Split mis-filed videos out of `images`, dedupe, and keep arrays ready for image/video sitemaps,
 * watch pages, and JSON-LD. Applied on every create/update via the listings API.
 */
export function normalizeListingMediaForSeo(
  rawImages: { url?: string; public_id?: string }[] | undefined,
  rawVideos: { url?: string; public_id?: string }[] | undefined
): { images: ListingMediaRecord[]; videos: ListingMediaRecord[] } {
  const images: ListingMediaRecord[] = [];
  const videos: ListingMediaRecord[] = [];

  for (const v of rawVideos ?? []) {
    const rec = toMediaRecord(v);
    if (rec) videos.push(rec);
  }

  for (const img of rawImages ?? []) {
    const rec = toMediaRecord(img);
    if (!rec) continue;
    if (isVideoUrl(rec.url)) {
      videos.push(rec);
    } else {
      images.push(rec);
    }
  }

  return {
    images: dedupeImagesByPublicId(images),
    videos: dedupeImagesByPublicId(videos),
  };
}

/** Ensure import listings carry tags used by sitemaps and internal linking. */
export function applyImportSeoTags(tags: string[] | undefined): string[] {
  const base = normalizeList(tags);
  const isImport = base.some(
    (t) => t === WHATSAPP_IMPORT_TAG || t === WHATSAPP_CHAT_IMPORT_TAG
  );
  if (!isImport) return base;
  return mergeUniqueLists(base, [WHATSAPP_CHAT_IMPORT_TAG, WHATSAPP_IMPORT_TAG]);
}

/** Expand thin WhatsApp paste descriptions into indexable copy (price, type, location, media). */
export function enrichListingDescriptionForSeo(fields: ListingShareFields): string {
  const raw = (fields.description ?? '').trim();
  if (raw.length >= MIN_SEO_DESCRIPTION_LEN) return raw;
  return buildListingShareDescription(fields, { maxLen: 5000 });
}

export type ListingSeoPrepInput = {
  title: string;
  description?: string | null;
  price: number;
  listingType?: string | null;
  rentPeriod?: string | null;
  propertyType?: string | null;
  propertyTypes?: string[] | null;
  location?: ListingShareFields['location'];
  images?: { url?: string; public_id?: string }[];
  videos?: { url?: string; public_id?: string }[];
  tags?: string[];
  amenities?: string[];
};

export function prepareListingFieldsForSeo(input: ListingSeoPrepInput): {
  description: string;
  images: ListingMediaRecord[];
  videos: ListingMediaRecord[];
  tags: string[];
} {
  const { images, videos } = normalizeListingMediaForSeo(input.images, input.videos);
  const tags = applyImportSeoTags(input.tags);
  const shareFields = listingDocToShareFields({
    title: input.title,
    description: input.description,
    price: input.price,
    listingType: input.listingType,
    rentPeriod: input.rentPeriod,
    propertyType: input.propertyType,
    propertyTypes: input.propertyTypes,
    location: input.location,
    images,
    videos,
  });
  const description = enrichListingDescriptionForSeo(shareFields);
  return { description, images, videos, tags };
}
