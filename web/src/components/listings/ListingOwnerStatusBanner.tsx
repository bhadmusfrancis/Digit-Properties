import { LISTING_STATUS } from '@/lib/constants';
import { getOwnerPendingApprovalMessage } from '@/lib/listing-status-display';
import { SystemNotice } from '@/components/ui/SystemNotice';

type Props = {
  status: string;
  pendingApprovalReasons?: string[];
};

/** Shown to the listing owner when their property is awaiting admin approval. */
export function ListingOwnerStatusBanner({ status, pendingApprovalReasons }: Props) {
  if (status !== LISTING_STATUS.PENDING_APPROVAL) return null;

  const reasons = pendingApprovalReasons?.filter(Boolean) ?? [];

  return (
    <SystemNotice kind="warning" title="Pending approval">
      <p>{getOwnerPendingApprovalMessage(reasons)}</p>
      {reasons.length > 1 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </SystemNotice>
  );
}
