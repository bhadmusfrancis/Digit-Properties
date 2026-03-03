'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function MyListingActions({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
      else alert((await res.json()).error || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Link href={`/listings/${listingId}`} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 -m-1 rounded text-primary-600 hover:underline text-sm touch-manipulation">View</Link>
      <span className="text-gray-300">|</span>
      <Link href={`/listings/${listingId}/edit`} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 -m-1 rounded text-primary-600 hover:underline text-sm touch-manipulation">Edit</Link>
      <span className="text-gray-300">|</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 -m-1 rounded text-red-600 hover:underline text-sm disabled:opacity-50 touch-manipulation"
      >
        {deleting ? '…' : 'Delete'}
      </button>
    </span>
  );
}
