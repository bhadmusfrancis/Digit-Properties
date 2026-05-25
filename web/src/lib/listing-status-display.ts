import { LISTING_STATUS } from '@/lib/constants';

/** Human-readable status for listing owners (dashboard, detail, edit). */
export function formatOwnerListingStatus(status: string): string {
  switch (status) {
    case LISTING_STATUS.PENDING_APPROVAL:
      return 'Pending approval';
    case LISTING_STATUS.DRAFT:
      return 'Draft';
    case LISTING_STATUS.ACTIVE:
      return 'Active';
    case LISTING_STATUS.PAUSED:
      return 'Paused';
    case LISTING_STATUS.CLOSED:
      return 'Closed';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function ownerListingStatusBadgeClass(status: string): string {
  switch (status) {
    case LISTING_STATUS.ACTIVE:
      return 'bg-green-100 text-green-800';
    case LISTING_STATUS.DRAFT:
      return 'bg-gray-100 text-gray-800';
    case LISTING_STATUS.PENDING_APPROVAL:
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

export function isListingPendingApproval(status: string | undefined): boolean {
  return status === LISTING_STATUS.PENDING_APPROVAL;
}

export function getOwnerPendingApprovalMessage(reasons?: string[]): string {
  if (reasons?.length) {
    const extra = reasons.length > 1 ? ` (+${reasons.length - 1} more)` : '';
    return `This listing is hidden from search and public browse until an admin approves it. ${reasons[0]}${extra}`;
  }
  return 'This listing is hidden from search and public browse until an admin approves it.';
}
