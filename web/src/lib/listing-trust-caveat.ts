import { USER_ROLES } from '@/lib/constants';
import { isPublicVerifiedAccount } from '@/lib/verification';

export type ListingTrustCaveatInput = {
  role?: string | null;
  createdByType?: string | null;
  /** From `shapePublicCreatedBy` on listing cards and detail pages. */
  isVerifiedAccount?: boolean;
};

/**
 * Show a subtle caution for listings from bot or unverified accounts.
 * Verified agents, developers, and admin-approved individuals are excluded.
 */
export function shouldShowListingTrustCaveat(input: ListingTrustCaveatInput): boolean {
  const createdByType = (input.createdByType || '').toLowerCase();
  if (createdByType === 'bot' || createdByType === 'ai') return true;

  const role = (input.role || '').toLowerCase();
  if (role === USER_ROLES.BOT) return true;

  if (input.isVerifiedAccount === true) return false;
  if (isPublicVerifiedAccount({ role: input.role ?? undefined })) return false;

  // Guest and other non–admin-approved roles
  return true;
}

export const LISTING_TRUST_CAVEAT_TEXT =
  'Please verify the accuracy and authenticity of this property before making payment or any commitment.';

/** Build caveat props from a listing card or detail document. */
export function listingTrustCaveatFromListing(listing: {
  createdByType?: string | null;
  createdBy?: { role?: string; isVerifiedAccount?: boolean } | null;
}): ListingTrustCaveatInput {
  return {
    role: listing.createdBy?.role,
    createdByType: listing.createdByType,
    isVerifiedAccount: listing.createdBy?.isVerifiedAccount,
  };
}
