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
    <>
      <Link href={`/listings/${listingId}`} className="text-primary-600 hover:underline">
        View
      </Link>
      {' · '}
      <Link href={`/listings/${listingId}/edit`} className="text-primary-600 hover:underline">
        Edit
      </Link>
      {' · '}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        {deleting ? 'Deleting...' : 'Delete'}
      </button>
    </>
  );
}
