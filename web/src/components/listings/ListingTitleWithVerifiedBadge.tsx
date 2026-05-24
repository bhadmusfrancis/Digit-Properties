'use client';

import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import type { PublicCreatedBy } from '@/lib/verification';

export function ListingTitleWithVerifiedBadge({
  title,
  createdBy,
  showVerifiedBadge = true,
}: {
  title: string;
  createdBy: PublicCreatedBy | null;
  /** Hide author verification badge (e.g. bot-ingested listings). */
  showVerifiedBadge?: boolean;
}) {
  return (
    <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-gray-900">
      <span>{title}</span>
      {showVerifiedBadge && (
        <VerifiedBadge
          role={createdBy?.role ?? ''}
          isVerifiedAccount={createdBy?.isVerifiedAccount ?? false}
          compact
        />
      )}
    </h1>
  );
}
