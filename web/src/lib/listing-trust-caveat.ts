import { USER_ROLES } from '@/lib/constants';

/**
 * Show a subtle caution for listings posted by bot/unverified accounts.
 */
export function shouldShowListingTrustCaveat(input: {
  role?: string | null;
  createdByType?: string | null;
}): boolean {
  const role = (input.role || '').toLowerCase();
  const createdByType = (input.createdByType || '').toLowerCase();

  if (role === USER_ROLES.BOT) return true;
  if (createdByType === 'bot') return true;
  // Guest accounts are not identity-verified.
  if (role === USER_ROLES.GUEST) return true;
  return false;
}

export const LISTING_TRUST_CAVEAT_TEXT =
  'Please verify availability and authenticity before making payment or commitments.';

