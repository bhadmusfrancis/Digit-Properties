'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { LISTING_TYPE } from '@/lib/constants';
import { toFirstName } from '@/lib/display-name';
import type { PublicCreatedBy } from '@/lib/verification';

type OfferRow = {
  _id: string;
  amount: number;
  status: string;
  turn: string;
  listingPriceAtCreate: number;
  createdAt?: string;
  updatedAt?: string;
  buyer: PublicCreatedBy | null;
};

type OffersPayload = {
  offersEnabled: boolean;
  listingPrice: number;
  offers: OfferRow[];
};

function formatNgn(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export function ProfessionalOffersPanel({
  listingId,
  listingType,
  isOwner,
}: {
  listingId: string;
  listingType: string;
  isOwner: boolean;
}) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [amountInput, setAmountInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [counterByOffer, setCounterByOffer] = useState<Record<string, string>>({});
  const [counterMsgByOffer, setCounterMsgByOffer] = useState<Record<string, string>>({});

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['listing-offers', listingId],
    queryFn: async () => {
      const r = await fetch(`/api/listings/${listingId}/offers`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Failed to load offers');
      return j as OffersPayload;
    },
    enabled: listingType === LISTING_TYPE.SALE && !!listingId,
  });

  const createOffer = useMutation({
    mutationFn: async () => {
      const amount = Number(String(amountInput).replace(/,/g, ''));
      const r = await fetch(`/api/listings/${listingId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          message: messageInput.trim() || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Could not send offer');
      return j;
    },
    onSuccess: () => {
      setAmountInput('');
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['listing-offers', listingId] });
    },
  });

  const patchOffer = useMutation({
    mutationFn: async ({ offerId, body }: { offerId: string; body: Record<string, unknown> }) => {
      const r = await fetch(`/api/listings/${listingId}/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Update failed');
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-offers', listingId] });
    },
  });

  const negotiatingMine = useMemo(() => {
    if (!data?.offers?.length) return null;
    return data.offers.find((o) => o.status === 'negotiating') ?? null;
  }, [data?.offers]);

  if (listingType !== LISTING_TYPE.SALE) return null;

  if (isPending || !data) {
    return (
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" aria-hidden />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-sm text-red-600">{(error as Error)?.message}</p>
      </div>
    );
  }

  const { offersEnabled, listingPrice, offers } = data;

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h4 className="text-sm font-semibold text-gray-900">Professional offers</h4>
      <p className="mt-1 text-xs text-gray-500">
        Logged-in buyers can send a formal price offer on verified for-sale listings. The owner may accept, decline, or counter.
      </p>

      {!offersEnabled && (
        <p className="mt-2 text-sm text-gray-600">
          Offers are not enabled for this listing (must be active, for sale, and listed by a verified account).
        </p>
      )}

      {offersEnabled && status === 'unauthenticated' && !isOwner && (
        <p className="mt-3 text-sm text-gray-700">
          <Link href={`/auth/signin?callbackUrl=/listings/${listingId}`} className="font-medium text-primary-600 hover:underline">
            Sign in
          </Link>{' '}
          to send a professional offer.
        </p>
      )}

      {offersEnabled && session && !isOwner && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {!negotiatingMine && (
            <>
              <p className="text-xs text-gray-600">Asking price: {formatNgn(listingPrice)}</p>
              <label className="mt-2 block text-xs font-medium text-gray-700">Your offer (NGN)</label>
              <input
                type="text"
                inputMode="decimal"
                className="input mt-1 w-full"
                placeholder="e.g. 45000000"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value.replace(/[^\d.]/g, ''))}
              />
              <label className="mt-2 block text-xs font-medium text-gray-700">Message (optional)</label>
              <textarea
                className="input mt-1 min-h-[72px] w-full resize-y"
                maxLength={1000}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary mt-2 w-full"
                disabled={createOffer.isPending || !amountInput}
                onClick={() => createOffer.mutate()}
              >
                {createOffer.isPending ? 'Sending…' : 'Send professional offer'}
              </button>
              {createOffer.isError && (
                <p className="mt-2 text-xs text-red-600">{(createOffer.error as Error)?.message}</p>
              )}
            </>
          )}
          {negotiatingMine && (
            <div className="space-y-2 text-sm">
              <p>
                Current offer on the table: <span className="font-semibold text-gray-900">{formatNgn(negotiatingMine.amount)}</span>
              </p>
              <p className="text-xs text-gray-600">
                {negotiatingMine.turn === 'seller' ? 'Waiting for the seller to respond.' : 'The seller countered — you can respond with a new amount or withdraw.'}
              </p>
              {negotiatingMine.turn === 'buyer' && (
                <>
                  <label className="mt-2 block text-xs font-medium text-gray-700">Your counter (NGN)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input mt-1 w-full"
                    value={counterByOffer[negotiatingMine._id] ?? ''}
                    onChange={(e) =>
                      setCounterByOffer((m) => ({ ...m, [negotiatingMine._id]: e.target.value.replace(/[^\d.]/g, '') }))
                    }
                  />
                  <label className="mt-2 block text-xs font-medium text-gray-700">Note (optional)</label>
                  <textarea
                    className="input mt-1 min-h-[56px] w-full resize-y"
                    maxLength={1000}
                    value={counterMsgByOffer[negotiatingMine._id] ?? ''}
                    onChange={(e) =>
                      setCounterMsgByOffer((m) => ({ ...m, [negotiatingMine._id]: e.target.value }))
                    }
                  />
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="btn-primary flex-1"
                      disabled={
                        patchOffer.isPending || !(Number(String(counterByOffer[negotiatingMine._id] ?? '').replace(/,/g, '')) > 0)
                      }
                      onClick={() => {
                        const raw = counterByOffer[negotiatingMine._id] ?? '';
                        const amount = Number(String(raw).replace(/,/g, ''));
                        patchOffer.mutate({
                          offerId: negotiatingMine._id,
                          body: {
                            action: 'counter',
                            amount,
                            message: (counterMsgByOffer[negotiatingMine._id] ?? '').trim() || undefined,
                          },
                        });
                      }}
                    >
                      Send counter
                    </button>
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      disabled={patchOffer.isPending}
                      onClick={() => patchOffer.mutate({ offerId: negotiatingMine._id, body: { action: 'withdraw' } })}
                    >
                      Withdraw offer
                    </button>
                  </div>
                </>
              )}
              {negotiatingMine.turn === 'seller' && (
                <button
                  type="button"
                  className="btn-secondary mt-2 w-full"
                  disabled={patchOffer.isPending}
                  onClick={() => patchOffer.mutate({ offerId: negotiatingMine._id, body: { action: 'withdraw' } })}
                >
                  Withdraw offer
                </button>
              )}
              {patchOffer.isError && (
                <p className="text-xs text-red-600">{(patchOffer.error as Error)?.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {isOwner && offers.length > 0 && (
        <ul className="mt-3 space-y-3">
          {offers.map((o) => (
            <li key={o._id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-gray-900">
                  {o.buyer?._id ? (
                    <Link href={`/authors/${o.buyer._id}`} className="text-primary-600 hover:underline">
                      {toFirstName(o.buyer.firstName, o.buyer.name, 'Buyer')}
                    </Link>
                  ) : (
                    'Buyer'
                  )}
                </span>
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
              <p className="mt-1 text-gray-700">
                Offer: <span className="font-semibold">{formatNgn(o.amount)}</span>
                {o.status === 'negotiating' && (
                  <span className="ml-2 text-xs text-gray-500">
                    {o.turn === 'seller' ? '(your move)' : '(awaiting buyer)'}
                  </span>
                )}
              </p>
              {o.status === 'negotiating' && o.turn === 'seller' && (
                <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      disabled={patchOffer.isPending}
                      onClick={() => patchOffer.mutate({ offerId: o._id, body: { action: 'accept' } })}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      disabled={patchOffer.isPending}
                      onClick={() => patchOffer.mutate({ offerId: o._id, body: { action: 'decline' } })}
                    >
                      Decline
                    </button>
                  </div>
                  <label className="block text-xs font-medium text-gray-700">Counter amount (NGN)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input w-full"
                    placeholder="Counter price"
                    value={counterByOffer[o._id] ?? ''}
                    onChange={(e) => setCounterByOffer((m) => ({ ...m, [o._id]: e.target.value.replace(/[^\d.]/g, '') }))}
                  />
                  <label className="block text-xs font-medium text-gray-700">Note (optional)</label>
                  <textarea
                    className="input min-h-[56px] w-full resize-y"
                    maxLength={1000}
                    value={counterMsgByOffer[o._id] ?? ''}
                    onChange={(e) => setCounterMsgByOffer((m) => ({ ...m, [o._id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn-secondary w-full text-sm"
                    disabled={patchOffer.isPending || !(Number(String(counterByOffer[o._id] ?? '').replace(/,/g, '')) > 0)}
                    onClick={() => {
                      const amount = Number(String(counterByOffer[o._id] ?? '').replace(/,/g, ''));
                      patchOffer.mutate({
                        offerId: o._id,
                        body: {
                          action: 'counter',
                          amount,
                          message: (counterMsgByOffer[o._id] ?? '').trim() || undefined,
                        },
                      });
                    }}
                  >
                    Send counter-offer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && offers.length === 0 && offersEnabled && (
        <p className="mt-2 text-sm text-gray-500">No offers yet. Buyers with accounts will see the option to send one here.</p>
      )}

      {!isOwner && offersEnabled && session && negotiatingMine === null && offers.some((o) => o.status !== 'negotiating') && (
        <p className="mt-2 text-xs text-gray-500">
          <button type="button" className="text-primary-600 hover:underline" onClick={() => refetch()}>
            Refresh
          </button>{' '}
          to see past offers.
        </p>
      )}
    </div>
  );
}
