import { stripHtml } from '@/lib/utils';
import {
  isDefaultListingImageUrl,
  isVideoUrl,
  listingHasVideoMedia,
  type ListingVideoRef,
} from '@/lib/listing-default-image';

/**
 * Minimum unique description length (plain text) for a media-less listing to be
 * worth indexing on its own. Below this, the page is "thin" and Google tends to
 * cluster it with other near-identical placeholder listings ("Duplicate, Google
 * chose different canonical than user").
 */
export const MIN_INDEXABLE_DESCRIPTION_CHARS = 250;

type IndexableListingInput = {
  images?: { url?: string }[] | undefined;
  videos?: ListingVideoRef[] | undefined;
  description?: string | null | undefined;
};

/** True when the listing has its own uploaded photo or video (not a shared placeholder). */
export function listingHasOwnMedia(input: IndexableListingInput): boolean {
  const images = input.images ?? [];
  const hasRealStill = images.some((img) => {
    const url = typeof img?.url === 'string' ? img.url.trim() : '';
    return !!url && !isDefaultListingImageUrl(url) && !isVideoUrl(url);
  });
  if (hasRealStill) return true;
  return listingHasVideoMedia(input.images, input.videos);
}

/**
 * Whether a listing detail page has enough unique content to be indexed.
 *
 * A listing is indexable when it has its own media (unique photos/video) OR a
 * substantial unique description. Listings with neither fall back to a shared
 * stock image and thin text, which Google treats as duplicates of each other —
 * so we keep those crawlable (follow) but out of the index until they're enriched.
 */
export function isListingIndexable(input: IndexableListingInput): boolean {
  if (listingHasOwnMedia(input)) return true;
  const text = stripHtml(input.description ?? '');
  return text.length >= MIN_INDEXABLE_DESCRIPTION_CHARS;
}
