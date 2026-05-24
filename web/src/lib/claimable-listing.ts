import { USER_ROLES } from '@/lib/constants';

/**
 * Listings can be claimed when they were ingested as bot pipeline (createdByType bot)
 * OR when the listing owner account is a BOT user (e.g. imports attributed to the bot user).
 */
export function isClaimableListingDoc(doc: {
  createdByType?: string | null;
  createdBy?: unknown;
  tags?: string[] | null;
}): boolean {
  return isBotListingAuthor(doc);
}

const BOT_LISTING_TYPES = new Set(['bot', 'ai']);

/** Listing posted via bot ingest or owned by a BOT user account. */
export function isBotListingAuthor(doc: {
  createdByType?: string | null;
  createdBy?: unknown;
  tags?: string[] | null;
}): boolean {
  const createdByType = (doc?.createdByType || '').toLowerCase();
  if (BOT_LISTING_TYPES.has(createdByType)) return true;
  if (
    Array.isArray(doc?.tags) &&
    doc.tags.some((t) => String(t).toLowerCase() === 'whatsapp-import')
  ) {
    return true;
  }
  const cb = doc?.createdBy;
  if (cb && typeof cb === 'object' && cb !== null && 'role' in cb) {
    const role = String((cb as { role?: string }).role || '').toLowerCase();
    if (role === USER_ROLES.BOT) return true;
  }
  return false;
}
