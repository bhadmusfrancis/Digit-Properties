'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BOOST_PACKAGES, BOOST_VISIBILITY_DISCLAIMER } from '@/lib/boost-packages';

type BoostPackageId = keyof typeof BOOST_PACKAGES;

export function MyListingActions({
  listingId,
  listingType,
  soldAt,
  rentedAt,
  canEdit = true,
}: {
  listingId: string;
  listingType: string;
  soldAt?: string;
  rentedAt?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<BoostPackageId>('starter');
  const [marking, setMarking] = useState<'sold' | 'rented' | null>(null);
  const isRentListing = listingType === 'rent';

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

  async function handleBoost() {
    if (boosting) return;
    setBoosting(true);
    try {
      const res = await fetch('/api/payments/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, gateway: 'paystack', packageId: selectedPackage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Failed to start boost payment');
        return;
      }
      const url = data.authorization_url || data.link;
      if (url) {
        window.location.href = url as string;
        return;
      }
      alert('Boost payment link not returned.');
    } finally {
      setBoosting(false);
    }
  }

  async function toggleMarketStatus(kind: 'sold' | 'rented') {
    if (marking) return;
    setMarking(kind);
    try {
      const payload =
        kind === 'sold'
          ? { soldAt: !Boolean(soldAt), rentedAt: false }
          : { rentedAt: !Boolean(rentedAt), soldAt: false };
      const res = await fetch(`/api/listings/${listingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to update listing status');
        return;
      }
      router.refresh();
    } finally {
      setMarking(null);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <Link
        href={`/listings/${listingId}`}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:min-h-[34px]"
        title="View listing"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12z" />
        </svg>
        View
      </Link>
      {canEdit ? (
        <Link
          href={`/listings/${listingId}/edit`}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:min-h-[34px]"
          title="Edit listing"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </Link>
      ) : (
        <span
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs font-medium text-gray-400 sm:min-h-[34px]"
          title="Only admins can edit after 24 hours"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Edit locked
        </span>
      )}
      <button
        type="button"
        onClick={() => setBoostOpen(true)}
        disabled={boosting}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 sm:min-h-[34px]"
        title="Boost listing"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {boosting ? '…' : 'Boost'}
      </button>
      {isRentListing ? (
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(rentedAt)}
          onClick={() => toggleMarketStatus('rented')}
          disabled={marking !== null}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:min-h-[34px]"
          title={rentedAt ? 'Mark as available (turn rented off)' : 'Mark listing as rented'}
        >
          <span>{marking === 'rented' ? 'Updating…' : 'Rented'}</span>
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
              rentedAt ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                rentedAt ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(soldAt)}
          onClick={() => toggleMarketStatus('sold')}
          disabled={marking !== null}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:min-h-[34px]"
          title={soldAt ? 'Mark as available (turn sold off)' : 'Mark listing as sold'}
        >
          <span>{marking === 'sold' ? 'Updating…' : 'Sold'}</span>
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
              soldAt ? 'bg-red-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                soldAt ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 sm:min-h-[34px]"
        title="Delete listing"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
        </svg>
        {deleting ? '…' : 'Delete'}
      </button>
      {boostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Choose a boost package</h3>
            <p className="mt-1 text-sm text-gray-600">
              Select a package and continue with Paystack. Visibility scores compare plans using placement, duration, and
              limits—not live analytics.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Object.values(BOOST_PACKAGES).map((pkg) => (
                <label
                  key={pkg.id}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    selectedPackage === pkg.id
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                      : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{pkg.name}</span>
                    <input
                      type="radio"
                      name={`boost-package-${listingId}`}
                      checked={selectedPackage === pkg.id}
                      onChange={() => setSelectedPackage(pkg.id)}
                      className="h-4 w-4 border-gray-300 text-primary-600"
                    />
                  </div>
                  <p className="mt-1.5">
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                      {pkg.visibilityTier} visibility
                    </span>
                  </p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-gray-600">
                      <span>Visibility index</span>
                      <span className="font-semibold tabular-nums text-gray-900">
                        {pkg.visibilityIndex}/100
                        {pkg.visibilityVsStarterMultiplier > 1 ? (
                          <span className="ml-1 font-normal text-gray-500">
                            (~{pkg.visibilityVsStarterMultiplier}× vs Starter)
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all"
                        style={{ width: `${pkg.visibilityIndex}%` }}
                        role="progressbar"
                        aria-valuenow={pkg.visibilityIndex}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${pkg.name} visibility ${pkg.visibilityIndex} out of 100`}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{pkg.days} days boost</p>
                  <p className="mt-2 text-sm font-bold text-gray-900">NGN {pkg.amount.toLocaleString()}</p>
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    <li>{pkg.mediaUploads}</li>
                    <li>{pkg.categorySelection}</li>
                    <li>{pkg.displayPlacement}</li>
                    <li>{pkg.featured ? 'Includes Featured badge' : 'No Featured badge'}</li>
                    <li>{pkg.highlighted ? 'Includes Highlighted status' : 'No Highlighted status'}</li>
                  </ul>
                </label>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-snug text-gray-500">{BOOST_VISIBILITY_DISCLAIMER}</p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleBoost}
                disabled={boosting}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {boosting ? 'Processing…' : 'Pay with Paystack'}
              </button>
              <button
                type="button"
                onClick={() => setBoostOpen(false)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
