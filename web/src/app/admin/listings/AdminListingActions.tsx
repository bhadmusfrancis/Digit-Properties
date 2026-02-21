'use client';

import { useState } from 'react';
import Link from 'next/link';

type User = { _id: string; name?: string; email?: string };
type Props = { listingId: string; status: string; createdById: string; users: User[] };

export function AdminListingActions({ listingId, status, createdById, users }: Props) {
  const [assigning, setAssigning] = useState(false);
  const [approving, setApproving] = useState(false);

  const approve = () => {
    setApproving(true);
    fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
      .then((r) => r.ok && window.location.reload())
      .finally(() => setApproving(false));
  };

  const assign = (userId: string) => {
    if (!userId) return;
    setAssigning(true);
    fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ createdBy: userId }),
    })
      .then((r) => r.ok && window.location.reload())
      .finally(() => setAssigning(false));
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Link href={`/listings/${listingId}`} className="text-primary-600 hover:underline">View</Link>
      <Link href={`/listings/${listingId}/edit`} className="text-primary-600 hover:underline">Edit</Link>
      {status === 'draft' && (
        <button
          type="button"
          onClick={approve}
          disabled={approving}
          className="text-sm text-green-600 hover:underline disabled:opacity-50"
        >
          {approving ? '…' : 'Approve'}
        </button>
      )}
      <select
        value={createdById}
        onChange={(e) => assign(e.target.value)}
        disabled={assigning}
        className="rounded border border-gray-300 py-1 pl-2 pr-6 text-xs"
      >
        {users.map((u) => (
          <option key={u._id} value={u._id}>
            {u.name || u.email || u._id}
          </option>
        ))}
      </select>
    </span>
  );
}
