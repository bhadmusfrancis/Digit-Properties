import { USER_ROLES } from '@/lib/constants';

/** Non-admin owners may edit listings within this window from creation or claim time. */
export const NON_ADMIN_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Roles allowed to edit their own listings without the 24-hour window.
 * Admins can edit any listing; bot accounts can edit the listings they own
 * (i.e. unclaimed bot/imported listings) at any time.
 */
export function roleBypassesEditWindow(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return r === USER_ROLES.ADMIN || r === USER_ROLES.BOT;
}

export const LISTING_EDIT_WINDOW_HOURS = 24;

export const LISTING_CLAIM_EDIT_NOTICE =
  'You can edit claimed listings for 24 hours after you claim them. After that, only admins can make changes.';

export const LISTING_EDIT_LOCKED_TOOLTIP =
  'Editing is available for 24 hours after you create or claim a listing. Only admins can edit after that.';

export function getListingEditWindowStartMs(
  createdAt: Date | string | undefined,
  claimedAt?: Date | string | null
): number | null {
  if (claimedAt) {
    const claimedMs = new Date(claimedAt).getTime();
    if (Number.isFinite(claimedMs)) return claimedMs;
  }
  if (!createdAt) return null;
  const createdMs = new Date(createdAt).getTime();
  return Number.isFinite(createdMs) ? createdMs : null;
}

export function canNonAdminEditListing(opts: {
  createdAt?: Date | string;
  claimedAt?: Date | string | null;
  now?: number;
}): boolean {
  const startMs = getListingEditWindowStartMs(opts.createdAt, opts.claimedAt);
  if (startMs == null) return false;
  const now = opts.now ?? Date.now();
  return now - startMs <= NON_ADMIN_EDIT_WINDOW_MS;
}

/** Whether the current user may open/save the listing editor. Admins can edit every listing. */
export function canUserEditListing(opts: {
  role?: string | null;
  userId?: string | null;
  listingCreatedBy?: string | null;
  createdAt?: Date | string;
  claimedAt?: Date | string | null;
}): boolean {
  const role = (opts.role || '').toLowerCase();
  if (role === USER_ROLES.ADMIN) return true;
  const userId = opts.userId ? String(opts.userId) : '';
  const ownerId = opts.listingCreatedBy ? String(opts.listingCreatedBy) : '';
  if (!userId || !ownerId || userId !== ownerId) return false;
  if (roleBypassesEditWindow(role)) return true;
  return canNonAdminEditListing({
    createdAt: opts.createdAt,
    claimedAt: opts.claimedAt,
  });
}
