'use client';

import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import type { PublicCreatedBy } from '@/lib/verification';

export function ListingTitleWithVerifiedBadge({
  title,
  createdBy,
}: {
  title: string;
  createdBy: PublicCreatedBy | null;
}) {
  return (
    <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-gray-900">
      <span>{title}</span>
      <VerifiedBadge
        role={createdBy?.role ?? ''}
        isVerifiedAccount={createdBy?.isVerifiedAccount ?? false}
        compact
      />
    </h1>
  );
}
