'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type User = { _id: string; name?: string; email?: string };
type Props = {
  listingId: string;
  status: string;
  createdById: string;
  createdByLabel: string;
  users: User[];
  featured?: boolean;
  highlighted?: boolean;
  boostPackage?: string;
};

export function AdminListingActions({ listingId, status, createdById, createdByLabel, users, featured = false, highlighted = false, boostPackage = '' }: Props) {
  const [assigning, setAssigning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingFeatured, setTogglingFeatured] = useState(false);
  const [togglingHighlighted, setTogglingHighlighted] = useState(false);
  const [search, setSearch] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [packageUpdating, setPackageUpdating] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(boostPackage);

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

  const toggleFeature = (field: 'featured' | 'highlighted', value: boolean) => {
    const setBusy = field === 'featured' ? setTogglingFeatured : setTogglingHighlighted;
    setBusy(true);
    fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d));
        window.location.reload();
      })
      .catch((d) => alert(d?.error || `Failed to update ${field}`))
      .finally(() => setBusy(false));
  };

  const assignPackage = () => {
    if (packageUpdating) return;
    setPackageUpdating(true);
    fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boostPackage: selectedPackage || null }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d));
        window.location.reload();
      })
      .catch((d) => alert(d?.error || 'Failed to assign package'))
      .finally(() => setPackageUpdating(false));
  };

  return (
    <span className="flex w-full flex-wrap items-center justify-start gap-2 sm:flex-nowrap sm:justify-between">
      <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1">
        <Link href={`/listings/${listingId}`} className="inline-flex min-h-[32px] items-center justify-center rounded border border-primary-200 bg-primary-50 px-2 text-[11px] font-semibold text-primary-700 hover:bg-primary-100 touch-manipulation">View</Link>
        <Link href={`/listings/${listingId}/edit`} className="inline-flex min-h-[32px] items-center justify-center rounded border border-primary-200 bg-white px-2 text-[11px] font-semibold text-primary-700 hover:bg-primary-50 touch-manipulation">Edit</Link>
      </span>
      {status === 'draft' && (
        <button
          type="button"
          onClick={approve}
          disabled={approving}
          className="inline-flex min-h-[32px] items-center justify-center rounded border border-green-200 bg-green-50 px-2 text-[11px] font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 touch-manipulation"
        >
          {approving ? '…' : 'Approve'}
        </button>
      )}
      {(status === 'active' || status === 'pending_approval') && (
        <button
          type="button"
          onClick={deactivate}
          disabled={deactivating}
          className="inline-flex min-h-[32px] items-center justify-center rounded border border-amber-200 bg-amber-50 px-2 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 touch-manipulation"
          title="Deactivate (pause) listing"
        >
          {deactivating ? '…' : 'Deactivate'}
        </button>
      )}
      <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={() => toggleFeature('featured', !featured)}
          disabled={togglingFeatured}
          className="inline-flex min-h-[32px] items-center justify-center rounded border border-amber-200 bg-white px-2 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 touch-manipulation"
          title={featured ? 'Remove Featured' : 'Set Featured'}
        >
          {togglingFeatured ? '…' : featured ? 'Unfeature' : 'Feature'}
        </button>
        <button
          type="button"
          onClick={() => toggleFeature('highlighted', !highlighted)}
          disabled={togglingHighlighted}
          className="inline-flex min-h-[32px] items-center justify-center rounded border border-sky-200 bg-white px-2 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50 touch-manipulation"
          title={highlighted ? 'Remove Highlighted' : 'Set Highlighted'}
        >
          {togglingHighlighted ? '…' : highlighted ? 'Unhighlight' : 'Highlight'}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="inline-flex min-h-[32px] items-center justify-center rounded border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 touch-manipulation"
          title="Delete listing"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </span>
      <div className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1">
        <select
          value={selectedPackage}
          onChange={(e) => setSelectedPackage(e.target.value)}
          className="min-h-[32px] min-w-[112px] rounded border border-gray-300 bg-white px-2 text-[11px]"
          disabled={packageUpdating}
          title="Assign listing package"
        >
          <option value="">No package</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
        </select>
        <button
          type="button"
          onClick={assignPackage}
          disabled={packageUpdating}
          className="min-h-[32px] rounded border border-primary-300 bg-primary-50 px-2 text-[11px] font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-50"
        >
          {packageUpdating ? '…' : 'Apply'}
        </button>
      </div>
      <div className="relative inline-block shrink-0">
        <button
          type="button"
          onClick={() => setShowAssign((v) => !v)}
          disabled={assigning}
          className="min-h-[32px] min-w-[120px] rounded border border-gray-300 bg-white py-1 pl-2 pr-8 text-left text-[11px] touch-manipulation"
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
