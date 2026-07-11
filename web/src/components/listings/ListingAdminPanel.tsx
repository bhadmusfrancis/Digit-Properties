'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getTelHref, getWhatsAppUrl } from '@/lib/utils';

type Props = {
  listingId: string;
  listingType: string;
  listingTitle: string;
  soldAt?: string | Date | null;
  rentedAt?: string | Date | null;
  agentName?: string | null;
  agentPhone?: string | null;
  agentEmail?: string | null;
};

export function ListingAdminPanel({
  listingId,
  listingType,
  listingTitle,
  soldAt,
  rentedAt,
  agentName,
  agentPhone,
  agentEmail,
}: Props) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);
  const isRentListing = listingType === 'rent';
  const marketKind: 'sold' | 'rented' = isRentListing ? 'rented' : 'sold';
  const isMarked = isRentListing ? Boolean(rentedAt) : Boolean(soldAt);
  const name = typeof agentName === 'string' ? agentName.trim() : '';
  const phone = typeof agentPhone === 'string' ? agentPhone.trim() : '';
  const email = typeof agentEmail === 'string' ? agentEmail.trim() : '';
  const hasContact = Boolean(name || phone || email);
  const whatsappMessage = `Hi, I'm contacting you about "${listingTitle}" on Digit Properties.`;

  async function toggleMarketStatus() {
    if (marking) return;
    setMarking(true);
    try {
      const payload =
        marketKind === 'sold'
          ? { soldAt: !Boolean(soldAt), rentedAt: false }
          : { rentedAt: !Boolean(rentedAt), soldAt: false };
      const res = await fetch(`/api/listings/${listingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(typeof data?.error === 'string' ? data.error : 'Failed to update listing status');
        return;
      }
      router.refresh();
    } finally {
      setMarking(false);
    }
  }

  const marketButtonLabel = (() => {
    if (marking) return 'Updating…';
    if (isMarked) {
      return isRentListing ? 'Marked Rented — set available' : 'Marked Sold — set available';
    }
    return isRentListing ? 'Mark as Rented' : 'Mark as Sold';
  })();

  const marketButtonClass = isRentListing
    ? isMarked
      ? 'border-indigo-700 bg-indigo-600 text-white hover:bg-indigo-700'
      : 'border-indigo-600 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
    : isMarked
      ? 'border-red-700 bg-red-600 text-white hover:bg-red-700'
      : 'border-red-600 bg-red-50 text-red-800 hover:bg-red-100';

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-900">Admin</h3>

      <div className="mt-3">
        <h4 className="text-sm font-medium text-gray-900">Listing contact</h4>
        {hasContact ? (
          <div className="mt-1 space-y-1 text-sm text-gray-800">
            {name ? <p>{name}</p> : null}
            {phone ? (
              <p>
                <a href={getTelHref(phone)} className="font-medium text-primary-700 hover:underline">
                  {phone}
                </a>
              </p>
            ) : null}
            {email ? (
              <p>
                <a href={`mailto:${email}`} className="font-medium text-primary-700 hover:underline">
                  {email}
                </a>
              </p>
            ) : null}
            {phone ? (
              <div className="mt-2 flex flex-col gap-2">
                <a
                  href={getTelHref(phone)}
                  className="inline-flex items-center justify-center rounded-lg border border-primary-300 bg-white px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50"
                >
                  Call listing contact
                </a>
                <a
                  href={getWhatsAppUrl(phone, whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
                >
                  WhatsApp listing contact
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-sm text-gray-600">No stored listing contact on this property.</p>
        )}
      </div>

      <button
        type="button"
        onClick={toggleMarketStatus}
        disabled={marking}
        className={`mt-4 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-50 ${marketButtonClass}`}
        title={
          isMarked
            ? 'Remove sold/rented status and show as available again'
            : isRentListing
              ? 'Mark this rental as rented'
              : 'Mark this property as sold'
        }
      >
        {marketButtonLabel}
      </button>

      <div className="mt-3 flex gap-2">
        <Link
          href={`/listings/${listingId}/edit`}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Edit
        </Link>
        <Link
          href="/admin/listings"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Admin listings
        </Link>
      </div>
    </div>
  );
}
