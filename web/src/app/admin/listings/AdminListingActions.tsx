'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type User = { _id: string; name?: string; email?: string };
type Props = { listingId: string; status: string; createdById: string; createdByLabel: string; users: User[] };

export function AdminListingActions({ listingId, status, createdById, createdByLabel, users }: Props) {
  const [assigning, setAssigning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [search, setSearch] = useState('');
  const [showAssign, setShowAssign] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users.slice(0, 20);
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [users, search]);

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
    setShowAssign(false);
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
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowAssign((v) => !v)}
          disabled={assigning}
          className="rounded border border-gray-300 py-1 pl-2 pr-6 text-xs text-left min-w-[120px]"
        >
          {createdByLabel || 'Assign…'}
        </button>
        {showAssign && (
          <>
            <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded border border-gray-200 bg-white p-2 shadow-lg">
              <input
                type="text"
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input mb-2 w-full text-xs"
                autoFocus
              />
              <ul className="max-h-48 overflow-auto">
                {filteredUsers.map((u) => (
                  <li key={u._id}>
                    <button
                      type="button"
                      onClick={() => assign(u._id)}
                      className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100"
                    >
                      {u.name || u.email || u._id}
                      {u.email && u.name ? ` (${u.email})` : ''}
                    </button>
                  </li>
                ))}
                {filteredUsers.length === 0 && <li className="px-2 py-2 text-xs text-gray-500">No match</li>}
              </ul>
            </div>
            <div className="fixed inset-0 z-10" aria-hidden onClick={() => setShowAssign(false)} />
          </>
        )}
      </div>
    </span>
  );
}
