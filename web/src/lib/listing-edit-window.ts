/** Non-admin owners may edit listings within this window from creation or claim time. */
export const NON_ADMIN_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
