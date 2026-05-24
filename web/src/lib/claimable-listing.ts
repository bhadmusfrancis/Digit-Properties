import { USER_ROLES } from '@/lib/constants';

/**
 * Listings can be claimed when they were ingested as bot pipeline (createdByType bot)
 * OR when the listing owner account is a BOT user (e.g. imports attributed to the bot user).
 */
export function isClaimableListingDoc(doc: {
  createdByType?: string;
  createdBy?: unknown;
}): boolean {
  return isBotListingAuthor(doc);
}

/** Listing posted via bot ingest or owned by a BOT user account. */
export function isBotListingAuthor(doc: {
  createdByType?: string;
  createdBy?: unknown;
}): boolean {
  if (doc?.createdByType === 'bot') return true;
  const cb = doc?.createdBy;
  if (cb && typeof cb === 'object' && cb !== null && 'role' in cb) {
    if ((cb as { role?: string }).role === USER_ROLES.BOT) return true;
  }
  return false;
}
