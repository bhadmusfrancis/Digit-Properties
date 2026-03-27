'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type User = { _id: string; name?: string; email?: string };
type Props = { listingId: string; status: string; createdById: string; createdByLabel: string; users: User[] };

export function AdminListingActions({ listingId, status, createdById, createdByLabel, users }: Props) {
  const [assigning, setAssigning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const deactivate = () => {
    if (deactivating) return;
    setDeactivating(true);
    fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    })
      .then((r) => r.ok && window.location.reload())
      .catch(() => {})
      .finally(() => setDeactivating(false));
  };

  const remove = () => {
    if (deleting) return;
    if (!window.confirm('Delete this listing permanently?')) return;
    setDeleting(true);
    fetch(`/api/listings/${listingId}`, { method: 'DELETE' })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d));
        window.location.reload();
      })
      .catch((d) => {
        const msg = d?.error || 'Failed to delete listing';
        alert(msg);
      })
      .finally(() => setDeleting(false));
  };

  return (
    <span className="flex flex-wrap items-center gap-1 sm:gap-2">
      <Link href={`/listings/${listingId}`} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 -m-1 rounded text-primary-600 hover:underline text-sm touch-manipulation">View</Link>
      <Link href={`/listings/${listingId}/edit`} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 -m-1 rounded text-primary-600 hover:underline text-sm touch-manipulation">Edit</Link>
      {status === 'draft' && (
        <button
          type="button"
          onClick={approve}
          disabled={approving}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 -m-1 rounded text-sm text-green-600 hover:underline disabled:opacity-50 touch-manipulation"
        >
          {approving ? '…' : 'Approve'}
        </button>
      )}
      {(status === 'active' || status === 'pending_approval') && (
        <button
          type="button"
          onClick={deactivate}
          disabled={deactivating}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 -m-1 rounded text-sm text-amber-600 hover:underline disabled:opacity-50 touch-manipulation"
          title="Deactivate (pause) listing"
        >
          {deactivating ? '…' : 'Deactivate'}
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-1 px-2 -m-1 rounded text-sm text-red-600 hover:underline disabled:opacity-50 touch-manipulation"
        title="Delete listing"
      >
        {deleting ? '…' : 'Delete'}
      </button>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowAssign((v) => !v)}
          disabled={assigning}
          className="min-h-[44px] rounded border border-gray-300 py-2 pl-2 pr-8 text-xs text-left min-w-[120px] touch-manipulation"
        >
          {createdByLabel || 'Assign…'}
        </button>
        {showAssign && (
          <>
            <div className="absolute right-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded border border-gray-200 bg-white p-2 shadow-lg">
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
