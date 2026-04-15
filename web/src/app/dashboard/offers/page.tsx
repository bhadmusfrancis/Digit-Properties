'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type DashboardOfferRow = {
  _id: string;
  listingId: string;
  listing: { _id: string; title: string } | null;
  amount: number;
  status: string;
  turn: string;
  maintainAmount?: number;
  sellerCounterLocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
  yourRole: 'buyer' | 'seller';
  buyer: { _id: string; name: string; firstName: string } | null;
  seller: { _id: string; name: string; firstName: string } | null;
  canCounter: boolean;
  canMaintain: boolean;
  canAccept: boolean;
  canDecline: boolean;
  canWithdraw: boolean;
};

type OffersPayload = { offers: DashboardOfferRow[] };

function formatNgn(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

function displayName(person: DashboardOfferRow['buyer'] | DashboardOfferRow['seller'], fallback: string) {
  if (!person) return fallback;
  return person.firstName || person.name || fallback;
}

export default function DashboardOffersPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'action-needed'>('all');
  const [counterByOffer, setCounterByOffer] = useState<Record<string, string>>({});
  const [noteByOffer, setNoteByOffer] = useState<Record<string, string>>({});

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['dashboard-offers'],
    queryFn: async () => {
      const r = await fetch('/api/dashboard/offers');
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Failed to load offers');
      return j as OffersPayload;
    },
  });

  const patchOffer = useMutation({
    mutationFn: async ({
      listingId,
      offerId,
      body,
    }: {
      listingId: string;
      offerId: string;
      body: Record<string, unknown>;
    }) => {
      const r = await fetch(`/api/listings/${listingId}/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Offer update failed');
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-offers'] });
    },
  });

  const offers = data?.offers ?? [];
  const actionNeededCount = offers.filter((o) => o.canAccept || o.canDecline || o.canCounter || o.canMaintain || o.canWithdraw).length;
  const visibleOffers = useMemo(() => {
    if (filter === 'all') return offers;
    return offers.filter((o) => o.canAccept || o.canDecline || o.canCounter || o.canMaintain || o.canWithdraw);
  }, [offers, filter]);

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Offers</h1>
          <p className="mt-1 text-sm text-gray-600">Review and respond to property offers from your dashboard.</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1.5 ${filter === 'all' ? 'bg-primary-100 font-semibold text-primary-700' : 'text-gray-600'}`}
          >
            All ({offers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('action-needed')}
            className={`rounded-md px-3 py-1.5 ${filter === 'action-needed' ? 'bg-primary-100 font-semibold text-primary-700' : 'text-gray-600'}`}
          >
            Action needed ({actionNeededCount})
          </button>
        </div>
      </div>

      {isPending && <div className="mt-4 h-28 animate-pulse rounded-lg bg-gray-100" aria-hidden />}
      {isError && <p className="mt-4 text-sm text-red-600">{(error as Error)?.message}</p>}

      {!isPending && !isError && visibleOffers.length === 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          {filter === 'action-needed' ? 'No offers currently require your action.' : 'No offers yet.'}
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {visibleOffers.map((o) => {
          const listingTitle = o.listing?.title || 'Listing';
          const listingId = o.listingId || o.listing?._id || '';
          const counterparty = o.yourRole === 'seller' ? displayName(o.buyer, 'Buyer') : displayName(o.seller, 'Seller');
          return (
            <li key={o._id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/listings/${listingId}`} className="truncate text-sm font-semibold text-primary-600 hover:underline">
                    {listingTitle}
                  </Link>
                  <p className="mt-1 text-xs text-gray-500">
                    You are the {o.yourRole}. Counterparty: {counterparty}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    o.status === 'negotiating'
                      ? 'bg-amber-100 text-amber-800'
                      : o.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {o.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-700">
                Current offer: <span className="font-semibold">{formatNgn(o.amount)}</span>
                {o.status === 'negotiating' && (
                  <span className="ml-2 text-xs text-gray-500">{o.turn === o.yourRole ? '(your move)' : '(waiting for counterparty)'}</span>
                )}
              </p>
              {o.status === 'negotiating' && o.yourRole === 'seller' && o.turn === 'seller' && o.sellerCounterLocked && (
                <p className="mt-1 text-xs text-amber-700">
                  Buyer maintained their offer at {formatNgn(o.amount)}. You can accept or decline only.
                </p>
              )}

              {(o.canAccept || o.canDecline || o.canCounter || o.canMaintain || o.canWithdraw) && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {o.canCounter && (
                    <>
                      <label className="block text-xs font-medium text-gray-700">Counter amount (NGN)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input w-full"
                        placeholder="Counter amount"
                        value={counterByOffer[o._id] ?? ''}
                        onChange={(e) => setCounterByOffer((m) => ({ ...m, [o._id]: e.target.value.replace(/[^\d.]/g, '') }))}
                      />
                      <label className="block text-xs font-medium text-gray-700">Note (optional)</label>
                      <textarea
                        className="input min-h-[64px] w-full resize-y"
                        maxLength={1000}
                        value={noteByOffer[o._id] ?? ''}
                        onChange={(e) => setNoteByOffer((m) => ({ ...m, [o._id]: e.target.value }))}
                      />
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {o.canAccept && (
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        disabled={patchOffer.isPending}
                        onClick={() => patchOffer.mutate({ listingId, offerId: o._id, body: { action: 'accept' } })}
                      >
                        Accept
                      </button>
                    )}
                    {o.canDecline && (
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={patchOffer.isPending}
                        onClick={() => patchOffer.mutate({ listingId, offerId: o._id, body: { action: 'decline' } })}
                      >
                        Decline
                      </button>
                    )}
                    {o.canCounter && (
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={patchOffer.isPending || !(Number(String(counterByOffer[o._id] ?? '').replace(/,/g, '')) > 0)}
                        onClick={() =>
                          patchOffer.mutate({
                            listingId,
                            offerId: o._id,
                            body: {
                              action: 'counter',
                              amount: Number(String(counterByOffer[o._id] ?? '').replace(/,/g, '')),
                              message: (noteByOffer[o._id] ?? '').trim() || undefined,
                            },
                          })
                        }
                      >
                        Send counter
                      </button>
                    )}
                    {o.canMaintain && (
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={patchOffer.isPending}
                        onClick={() =>
                          patchOffer.mutate({
                            listingId,
                            offerId: o._id,
                            body: {
                              action: 'maintain',
                              message: (noteByOffer[o._id] ?? '').trim() || undefined,
                            },
                          })
                        }
                      >
                        Maintain my offer of {formatNgn(o.maintainAmount ?? o.amount)}
                      </button>
                    )}
                    {o.canWithdraw && (
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={patchOffer.isPending}
                        onClick={() => patchOffer.mutate({ listingId, offerId: o._id, body: { action: 'withdraw' } })}
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                  {patchOffer.isError && <p className="text-xs text-red-600">{(patchOffer.error as Error)?.message}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

