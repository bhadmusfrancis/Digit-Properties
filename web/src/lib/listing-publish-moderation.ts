import { LISTING_STATUS } from '@/lib/constants';
import { getListingModerationConfig } from '@/lib/listing-moderation-config';
import {
  detectListingSuspicion,
  type ListingSuspicionInput,
} from '@/lib/listing-suspicion';
import { sendAdminListingPendingApproval, sendAdminNewListing } from '@/lib/email';
import { notifyMatchingAlerts } from '@/lib/alerts';

export type PublishModerationContext = {
  isAdmin: boolean;
  isBot: boolean;
  requestedPublish: boolean;
  /** Current listing status before change (for edits). */
  previousStatus?: string;
};

export type ResolvedPublishStatus = {
  status: (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];
  suspicionReasons: string[];
  flaggedSuspicious: boolean;
};

/**
 * Decide final status when a non-admin user publishes or edits toward active.
 * Suspicious listings always require admin approval.
 */
export async function resolvePublishStatus(
  data: ListingSuspicionInput,
  ctx: PublishModerationContext
): Promise<ResolvedPublishStatus> {
  const suspicionReasons =
    !ctx.isAdmin && !ctx.isBot ? detectListingSuspicion(data) : [];
  const flaggedSuspicious = suspicionReasons.length > 0;

  const mod = await getListingModerationConfig();
  let status: (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS] = LISTING_STATUS.DRAFT;

  if (!ctx.requestedPublish) {
    return { status: LISTING_STATUS.DRAFT, suspicionReasons, flaggedSuspicious };
  }

  if (ctx.isAdmin || ctx.isBot) {
    return { status: LISTING_STATUS.ACTIVE, suspicionReasons: [], flaggedSuspicious: false };
  }

  const wasActive = ctx.previousStatus === LISTING_STATUS.ACTIVE;
  const wasDraftOrNew = !ctx.previousStatus || ctx.previousStatus === LISTING_STATUS.DRAFT;

  const needsApproval =
    flaggedSuspicious ||
    (wasDraftOrNew && mod.newListingsRequireApproval) ||
    (wasActive && mod.editedListingsRequireApproval);

  status = needsApproval ? LISTING_STATUS.PENDING_APPROVAL : LISTING_STATUS.ACTIVE;
  return { status, suspicionReasons, flaggedSuspicious };
}

/**
 * For PATCH: owner editing an already-active listing (content change, not draft→active).
 */
export async function resolveActiveListingEditStatus(
  data: ListingSuspicionInput,
  ctx: { isAdmin: boolean; isBot: boolean; wasActive: boolean }
): Promise<{ forcePending: boolean; suspicionReasons: string[] }> {
  if (!ctx.wasActive || ctx.isAdmin || ctx.isBot) {
    return { forcePending: false, suspicionReasons: [] };
  }

  const suspicionReasons = detectListingSuspicion(data);
  const mod = await getListingModerationConfig();
  const forcePending = suspicionReasons.length > 0 || mod.editedListingsRequireApproval;
  return { forcePending, suspicionReasons };
}

export type ListingEmailNotifyInput = {
  listingId: string;
  listingSlug?: string | null;
  title: string;
  listingType: string;
  price: number;
  createdByName: string;
  suspicionReasons?: string[];
  isEdit?: boolean;
};

/** Notify admin after publish flow; use pending template when awaiting approval. */
export async function notifyAdminListingPublish(input: ListingEmailNotifyInput & { status: string }): Promise<void> {
  const { status, suspicionReasons = [], isEdit, ...rest } = input;
  if (status === LISTING_STATUS.PENDING_APPROVAL) {
    await sendAdminListingPendingApproval({
      listingTitle: rest.title,
      listingId: rest.listingId,
      listingSlug: rest.listingSlug,
      createdByName: rest.createdByName,
      listingType: rest.listingType,
      price: rest.price,
      reasons: suspicionReasons,
      isEdit: !!isEdit,
    }).catch((e) => console.error('[listings] pending approval admin email:', e));
    return;
  }
  if (status === LISTING_STATUS.ACTIVE) {
    await sendAdminNewListing(
      rest.title,
      rest.listingId,
      rest.createdByName,
      rest.listingType,
      rest.price,
      rest.listingSlug
    ).catch((e) => console.error('[listings] admin email:', e));
  }
}

export async function notifyAlertsIfActive(status: string, listing: Parameters<typeof notifyMatchingAlerts>[0]): Promise<void> {
  if (status === LISTING_STATUS.ACTIVE) {
    await notifyMatchingAlerts(listing).catch((e) => console.error('[listings] alerts:', e));
  }
}
