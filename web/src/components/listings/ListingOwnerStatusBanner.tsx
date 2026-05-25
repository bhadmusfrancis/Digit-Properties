import { LISTING_STATUS } from '@/lib/constants';
import { getOwnerPendingApprovalMessage } from '@/lib/listing-status-display';

type Props = {
  status: string;
  pendingApprovalReasons?: string[];
};

/** Shown to the listing owner when their property is awaiting admin approval. */
export function ListingOwnerStatusBanner({ status, pendingApprovalReasons }: Props) {
  if (status !== LISTING_STATUS.PENDING_APPROVAL) return null;

  const reasons = pendingApprovalReasons?.filter(Boolean) ?? [];

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold text-amber-900">Pending approval</p>
      <p className="mt-1 text-amber-900">{getOwnerPendingApprovalMessage(reasons)}</p>
      {reasons.length > 1 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-800">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
