import { isBotListingAuthor } from '@/lib/claimable-listing';
import { toFirstName } from '@/lib/display-name';

export type ListingContactSource = 'listing' | 'author';

export type ListingContactRow = {
  agentName?: string | null;
  agentPhone?: string | null;
  agentEmail?: string | null;
  contactSource?: string | null;
  createdByType?: string | null;
  createdBy?: unknown;
  tags?: string[] | null;
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
