import {
  formatListingTypeLabel,
  formatPropertyTypesLine,
  LISTING_TYPE,
} from '@/lib/constants';
import { countListingGalleryItems, type ListingVideoRef } from '@/lib/listing-default-image';
import { formatListingLocationDisplay } from '@/lib/listing-location';
import { formatPrice, plainTextExcerpt } from '@/lib/utils';

export type ListingShareFields = {
  title: string;
  description?: string | null;
  price: number;
  listingType?: string | null;
  rentPeriod?: string | null;
  propertyType?: string | null;
  propertyTypes?: string[] | null;
  location?: {
    address?: string | null;
    suburb?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  images?: { url?: string }[] | null;
  videos?: ListingVideoRef[] | null;
};

export function listingDocToShareFields(listing: {
  title?: string;
  description?: string | null;
  price?: number;
  listingType?: string | null;
  rentPeriod?: string | null;
  propertyType?: string | null;
  propertyTypes?: string[] | null;
  location?: ListingShareFields['location'];
  images?: { url?: string }[] | null;
  videos?: ListingVideoRef[] | null;
}): ListingShareFields {
  return {
    title: String(listing.title ?? ''),
    description: listing.description,
    price: Number(listing.price) || 0,
    listingType: listing.listingType,
    rentPeriod: listing.rentPeriod,
    propertyType: listing.propertyType,
    propertyTypes: listing.propertyTypes,
    location: listing.location,
    images: listing.images,
    videos: listing.videos,
  };
}

function formatMediaFragment(photos: number, videos: number): string {
  if (!photos && !videos) return '';
  const parts: string[] = [];
  if (photos) parts.push(`${photos} photo${photos === 1 ? '' : 's'}`);
  if (videos) parts.push(`${videos} video${videos === 1 ? '' : 's'}`);
  return parts.join(', ');
}

export function buildListingDetailsLine(input: ListingShareFields): string {
  const rentPeriod =
    input.listingType === LISTING_TYPE.RENT && input.rentPeriod && ['day', 'month', 'year'].includes(input.rentPeriod)
      ? (input.rentPeriod as 'day' | 'month' | 'year')
      : undefined;
  const priceStr = formatPrice(Number(input.price) || 0, rentPeriod);
  const propertyLine = formatPropertyTypesLine(
    input.propertyTypes ?? undefined,
    String(input.propertyType ?? '')
  );
  const typeLabel = formatListingTypeLabel(String(input.listingType ?? ''));
  const loc = formatListingLocationDisplay(input.location);
  const { photos, videos } = countListingGalleryItems(
    input.images ?? undefined,
    input.videos ?? undefined
  );
  const mediaStr = formatMediaFragment(photos, videos);
  return [priceStr, propertyLine, typeLabel, loc, mediaStr].filter(Boolean).join(' · ');
}

/**
 * Plain-text summary for meta tags, Open Graph, and share dialogs (price, type, place, media counts + excerpt).
 */
export function buildListingShareDescription(
  input: ListingShareFields,
  options?: { maxLen?: number }
): string {
  const maxLen = options?.maxLen ?? 160;
  const details = buildListingDetailsLine(input);
  if (!details) {
    return plainTextExcerpt(input.description, maxLen, input.title);
  }
  const sep = ' — ';
  const roomForExcerpt = maxLen - details.length - sep.length;
  if (roomForExcerpt < 20) {
    return details.length > maxLen ? `${details.slice(0, Math.max(0, maxLen - 1))}…` : details;
  }
  const excerpt = plainTextExcerpt(input.description, roomForExcerpt, '');
  const excerptUse =
    excerpt && excerpt.trim() && excerpt.trim().toLowerCase() !== input.title.trim().toLowerCase()
      ? excerpt.trim()
      : '';
  if (!excerptUse) return details.length <= maxLen ? details : `${details.slice(0, Math.max(0, maxLen - 1))}…`;
  const combined = `${details}${sep}${excerptUse}`;
  if (combined.length <= maxLen) return combined;
  return combined.slice(0, maxLen);
}

export function buildListingOpenGraphImageAlt(input: ListingShareFields): string {
  const details = buildListingDetailsLine(input);
  const base = details ? `${input.title} — ${details}` : input.title;
  return base.length > 200 ? `${base.slice(0, 197)}…` : base;
}
