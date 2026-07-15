import { isVideoUrl } from '@/lib/listing-default-image';
import { dedupeImagesByPublicId } from '@/lib/listing-dedupe';
import { mergeUniqueLists, normalizeList } from '@/lib/listing-amenities';
import {
  listingDocToShareFields,
  type ListingShareFields,
} from '@/lib/listing-share-text';
import {
  buildHumanListingDescriptionHtml,
  humanListingDescriptionInputFromDoc,
  shouldHumanizeListingDescription,
} from '@/lib/listing-human-description';
import { prepareWhatsAppListingDescription } from '@/lib/whatsapp-listing-parser';

export const WHATSAPP_CHAT_IMPORT_TAG = 'whatsapp-chat-import';
export const WHATSAPP_IMPORT_TAG = 'whatsapp-import';

export type ListingMediaRecord = { url: string; public_id: string };

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

export function isWhatsAppImportTags(tags: string[] | undefined): boolean {
  if (!Array.isArray(tags)) return false;
  return tags.some(
    (t) => t === WHATSAPP_IMPORT_TAG || t === WHATSAPP_CHAT_IMPORT_TAG
  );
}

export type EnrichedListingDescription = {
  description: string;
  /** Set when the public description was rewritten from a shorter original. */
  originalDescription?: string;
  rewritten: boolean;
};

/** Expand very short descriptions into readable, indexable copy. */
export function enrichListingDescriptionForSeo(
  fields: ListingShareFields,
  options?: {
    tags?: string[];
    title?: string;
    bedrooms?: number;
    bathrooms?: number;
    toilets?: number;
    area?: number;
    amenities?: string[];
  }
): EnrichedListingDescription {
  const raw = (fields.description ?? '').trim();
  const waPrepared = isWhatsAppImportTags(options?.tags)
    ? prepareWhatsAppListingDescription(raw)
    : raw;

  if (!shouldHumanizeListingDescription(waPrepared)) {
    return { description: waPrepared, rewritten: false };
  }

  const rewritten = buildHumanListingDescriptionHtml(
    humanListingDescriptionInputFromDoc({
      title: options?.title ?? fields.title,
      description: waPrepared,
      price: fields.price,
      listingType: fields.listingType,
      rentPeriod: fields.rentPeriod,
      propertyType: fields.propertyType,
      propertyTypes: fields.propertyTypes ?? undefined,
      location: fields.location
        ? {
            address: fields.location.address ?? undefined,
            suburb: fields.location.suburb ?? undefined,
            city: fields.location.city ?? undefined,
            state: fields.location.state ?? undefined,
          }
        : undefined,
      bedrooms: options?.bedrooms,
      bathrooms: options?.bathrooms,
      toilets: options?.toilets,
      area: options?.area,
      amenities: options?.amenities,
    })
  );
  return {
    description: rewritten,
    originalDescription: waPrepared,
    rewritten: true,
  };
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
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  area?: number;
};

export function prepareListingFieldsForSeo(input: ListingSeoPrepInput): {
  description: string;
  originalDescription?: string;
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
  const enriched = enrichListingDescriptionForSeo(shareFields, {
    tags,
    title: input.title,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    toilets: input.toilets,
    area: input.area,
    amenities: input.amenities,
  });
  const nextTags = enriched.rewritten
    ? mergeUniqueLists(tags, ['wa-rewritten'])
    : tags;
  return {
    description: enriched.description,
    originalDescription: enriched.originalDescription,
    images,
    videos,
    tags: nextTags,
  };
}
