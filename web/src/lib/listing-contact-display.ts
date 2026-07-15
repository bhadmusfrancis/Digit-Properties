import { isBotListingAuthor } from '@/lib/claimable-listing';
import { toFirstName } from '@/lib/display-name';

export type ListingContactSource = 'listing' | 'author';

/** Chat imports under this price default to listing (poster) contact, even with media. */
export const LISTING_CONTACT_LOW_PRICE_NGN = 5_000_000;

export type ListingContactRow = {
  agentName?: string | null;
  agentPhone?: string | null;
  agentEmail?: string | null;
  contactSource?: string | null;
  createdByType?: string | null;
  createdBy?: unknown;
  tags?: string[] | null;
  price?: number | null;
  images?: { url?: string | null; public_id?: string | null }[] | null;
  videos?: { url?: string | null; public_id?: string | null }[] | null;
};

type CreatorContact = {
  firstName?: string;
  name?: string;
  phone?: string;
  email?: string;
};

export type ResolvedListingContact = {
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  contactSource: ListingContactSource;
  hasListingContact: boolean;
};

function listingContactFields(listing: ListingContactRow) {
  const agentName = typeof listing.agentName === 'string' ? listing.agentName.trim() : '';
  const agentPhone = typeof listing.agentPhone === 'string' ? listing.agentPhone.trim() : '';
  const agentEmail = typeof listing.agentEmail === 'string' ? listing.agentEmail.trim() : '';
  const hasListingContact = Boolean(agentName || agentPhone || agentEmail);
  return { agentName, agentPhone, agentEmail, hasListingContact };
}

function creatorFrom(listing: ListingContactRow): CreatorContact | null {
  const cb = listing.createdBy;
  if (!cb || typeof cb !== 'object') return null;
  return cb as CreatorContact;
}

function mediaItemPresent(item: { url?: string | null; public_id?: string | null } | null | undefined): boolean {
  return Boolean(item?.url?.trim() || item?.public_id?.trim());
}

export function listingHasMedia(listing: Pick<ListingContactRow, 'images' | 'videos'>): boolean {
  const imgs = Array.isArray(listing.images) ? listing.images : [];
  const vids = Array.isArray(listing.videos) ? listing.videos : [];
  return imgs.some(mediaItemPresent) || vids.some(mediaItemPresent);
}

/** Default for WhatsApp chat imports (editors can override via contactSource). */
export function defaultChatImportContactSource(opts: {
  hasMedia: boolean;
  price: number;
  hasListingContact: boolean;
}): ListingContactSource {
  if (!opts.hasListingContact) return 'author';
  const price = Number.isFinite(opts.price) ? opts.price : 0;
  const lowPrice = price > 0 && price < LISTING_CONTACT_LOW_PRICE_NGN;
  if (!opts.hasMedia || lowPrice) return 'listing';
  return 'author';
}

/** Prefer poster/listing contact when the listing stores contactSource=listing. */
export function shouldPreferListingContact(listing: ListingContactRow): boolean {
  const { hasListingContact } = listingContactFields(listing);
  return hasListingContact && listing.contactSource === 'listing';
}

/** Public contact shown on listing pages and /api/listings/[id]/contact. */
export function resolvePublicListingContact(listing: ListingContactRow): ResolvedListingContact {
  const { agentName, agentPhone, agentEmail, hasListingContact } = listingContactFields(listing);
  const creator = creatorFrom(listing);

  // Stored contactSource is authoritative so editors can switch Author ↔ Listing.
  if (shouldPreferListingContact(listing)) {
    return {
      agentName,
      agentPhone,
      agentEmail,
      contactSource: 'listing',
      hasListingContact,
    };
  }

  if (isBotListingAuthor(listing)) {
    // Bot/imported listings show the bot account's own (author) contact until
    // the listing is claimed, hiding the original poster's number.
    return {
      agentName: toFirstName(creator?.firstName, creator?.name, agentName),
      agentPhone: creator?.phone?.trim() || agentPhone,
      agentEmail: creator?.email?.trim() || agentEmail,
      contactSource: 'author',
      hasListingContact,
    };
  }

  return {
    agentName: toFirstName(creator?.firstName, creator?.name, agentName),
    agentPhone: creator?.phone?.trim() ?? agentPhone,
    agentEmail: creator?.email?.trim() ?? agentEmail,
    contactSource: 'author',
    hasListingContact,
  };
}

/** Name shown where "Listed by" appears. */
export function listingListedByContactName(listing: ListingContactRow): string {
  return resolvePublicListingContact(listing).agentName.trim();
}
