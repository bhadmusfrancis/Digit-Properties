'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ClaimApproveButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handle(approve: boolean) {
    setLoading(true);
    await fetch(`/api/claims/${claimId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <span className="flex flex-wrap justify-end gap-1 sm:gap-2">
      <button
        onClick={() => handle(true)}
        disabled={loading}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 rounded text-sm text-green-600 hover:underline disabled:opacity-50 touch-manipulation"
      >
        Approve
      </button>
      <button
        onClick={() => handle(false)}
        disabled={loading}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 rounded text-sm text-red-600 hover:underline disabled:opacity-50 touch-manipulation"
      >
        Reject
      </button>
    </span>
  );
}
