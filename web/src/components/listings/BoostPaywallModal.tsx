'use client';

import { useEffect, useMemo, useState } from 'react';
import { BOOST_PACKAGES, type BoostPackage } from '@/lib/boost-packages';
import { formatPrice } from '@/lib/utils';
import { resumePaystackInline } from '@/lib/paystack-inline';

export type PaywallReason =
  | 'images'
  | 'videos'
  | 'categories'
  | 'featured'
  | 'highlighted'
  | 'general';

const REASON_COPY: Record<PaywallReason, { title: string; sub: string }> = {
  images: {
    title: 'Add more photos by boosting this listing',
    sub: 'Your free plan limits photos per listing. A boost unlocks more photos plus better placement.',
  },
  videos: {
    title: 'Add more videos by boosting this listing',
    sub: 'Videos drive serious enquiries. Boost this listing to upload more clips and reach more buyers.',
  },
  categories: {
    title: 'Pick more categories by boosting',
    sub: 'Boost to list under multiple property categories and appear in more search filters.',
  },
  featured: {
    title: 'Get a Featured spot for this listing',
    sub: 'Featured listings appear on the homepage carousel — boost to unlock it.',
  },
  highlighted: {
    title: 'Highlight this listing in search',
    sub: 'Highlighted listings stand out in search results — boost to unlock the badge.',
  },
  general: {
    title: 'Boost this listing',
    sub: 'Pick a package to gain more exposure, more media slots, and Featured / Highlighted placement.',
  },
};

export type PaywallSuccess = {
  listingId: string;
  boostPackage: BoostPackage['id'];
  boostExpiresAt: string;
  featured: boolean;
  highlighted: boolean;
  paidWith: 'wallet' | 'paystack';
};

export type BoostPaywallModalProps = {
  open: boolean;
  reason?: PaywallReason;
  /** Existing listing ID (edit mode). When unset, `ensureListingId` is called before paying. */
  listingId?: string | null;
  /**
   * Persist the in-progress listing as a draft and resolve to its ID.
   * Used by the new-listing wizard so the boost can attach to a real document.
   * Returns `{ ok: false, message }` when the form isn't ready (e.g. earlier
   * wizard steps incomplete) so the modal can surface that without alerts.
   */
  ensureListingId?: () => Promise<
    | string
    | { ok: false; message: string }
    | null
  >;
  /**
   * Optional reason explaining why payment isn't currently possible (e.g. earlier
   * wizard steps not yet complete). When set the Pay buttons are disabled and
   * the message is shown prominently.
   */
  disabledReason?: string | null;
  /** Pre-select a package (e.g. user's current boost). */
  initialPackage?: BoostPackage['id'];
  onClose: () => void;
  onPaid: (info: PaywallSuccess) => void;
};

type WalletInfo = { balance: number; currency: string };

export function BoostPaywallModal({
  open,
  reason = 'general',
  listingId,
  ensureListingId,
  disabledReason,
  initialPackage = 'starter',
  onClose,
  onPaid,
}: BoostPaywallModalProps) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [packageId, setPackageId] = useState<BoostPackage['id']>(initialPackage);
  const [coupon, setCoupon] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [paying, setPaying] = useState<null | 'wallet' | 'paystack'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const selected = BOOST_PACKAGES[packageId];
  const copy = REASON_COPY[reason];

  const refreshWallet = async () => {
    setWalletLoading(true);
    try {
      const res = await fetch('/api/me/wallet?limit=1');
      if (!res.ok) throw new Error('wallet load failed');
      const data = await res.json();
      setWallet({ balance: Number(data?.balance ?? 0), currency: String(data?.currency || 'NGN') });
    } catch {
      setWallet({ balance: 0, currency: 'NGN' });
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      refreshWallet();
      setError(null);
      setInfo(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !paying) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, paying, onClose]);

  const isWalletDraftBlocked = !!disabledReason;
  const canPayWithWallet = useMemo(
    () => !isWalletDraftBlocked && !!wallet && wallet.balance >= selected.amount,
    [isWalletDraftBlocked, wallet, selected.amount]
  );

  const ensureId = async (): Promise<string | null> => {
    if (listingId) return listingId;
    if (!ensureListingId) {
      setError('Listing context is missing. Close this dialog and try again.');
      return null;
    }
    try {
      const result = await ensureListingId();
      if (typeof result === 'string') return result;
      if (result && typeof result === 'object' && result.ok === false) {
        setError(result.message);
        return null;
      }
      setError('Listing could not be prepared.');
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save listing draft');
      return null;
    }
  };

  const onRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponMsg(null);
    if (!coupon.trim()) return;
    setCouponBusy(true);
    try {
      const res = await fetch('/api/me/wallet/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponMsg({ ok: false, text: data.error || 'Could not redeem coupon' });
      } else {
        setCouponMsg({
          ok: true,
          text: `${formatPrice(data.amountCredited)} added — new balance ${formatPrice(data.balance)}.`,
        });
        setWallet({ balance: Number(data.balance ?? 0), currency: 'NGN' });
        setCoupon('');
      }
    } catch {
      setCouponMsg({ ok: false, text: 'Failed to redeem coupon' });
    } finally {
      setCouponBusy(false);
    }
  };

  const finishWithListing = async (
    id: string,
    paidWith: 'wallet' | 'paystack',
    fallback?: { boostExpiresAt?: string }
  ) => {
    try {
      const r = await fetch(`/api/listings/${id}`);
      if (r.ok) {
        const l = await r.json();
        onPaid({
          listingId: id,
          boostPackage: (l.boostPackage as BoostPackage['id']) ?? packageId,
          boostExpiresAt: l.boostExpiresAt ?? fallback?.boostExpiresAt ?? new Date().toISOString(),
          featured: !!l.featured,
          highlighted: !!l.highlighted,
          paidWith,
        });
        return;
      }
    } catch {
      /* fall through */
    }
    onPaid({
      listingId: id,
      boostPackage: packageId,
      boostExpiresAt: fallback?.boostExpiresAt ?? new Date().toISOString(),
      featured: selected.featured,
      highlighted: selected.highlighted,
      paidWith,
    });
  };

  const payWithWallet = async () => {
    setError(null);
    setInfo(null);
    setPaying('wallet');
    try {
      const id = await ensureId();
      if (!id) {
        return;
      }
      const res = await fetch('/api/payments/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id, gateway: 'wallet', packageId }),
      });
      const data = await res.json();
      if (!res.ok || !data.paidWithWallet) {
        setError(data.error || 'Wallet payment failed');
        return;
      }
      setInfo(`Boost active. Wallet balance: ${formatPrice(Number(data.balance ?? 0))}.`);
      await finishWithListing(id, 'wallet', { boostExpiresAt: data.boostExpiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet payment failed');
    } finally {
      setPaying(null);
    }
  };

  const payWithPaystack = async () => {
    setError(null);
    setInfo(null);
    setPaying('paystack');
    try {
      const id = await ensureId();
      if (!id) {
        return;
      }
      const res = await fetch('/api/payments/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id, gateway: 'paystack', packageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Paystack initialise failed');
        return;
      }
      const accessCode: string | undefined = data.access_code;
      if (!accessCode) {
        setError('Could not start Paystack checkout (no access code).');
        return;
      }
      const result = await resumePaystackInline(accessCode);
      if (result.status === 'cancel') {
        setError('Payment cancelled.');
        return;
      }
      if (result.status === 'error') {
        setError(result.message || 'Paystack error');
        return;
      }

      // Verify server-side and apply boost.
      const verifyRes = await fetch('/api/payments/boost/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: data.reference }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.ok) {
        setError(verifyData.error || 'Could not verify payment yet. Refresh in a moment.');
        return;
      }
      setInfo('Boost activated.');
      await finishWithListing(id, 'paystack');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paystack payment failed');
    } finally {
      setPaying(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-4"
      onClick={() => !paying && onClose()}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-amber-50 via-white to-emerald-50 p-5 sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Listing boost</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">{copy.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{copy.sub}</p>
          </div>
          <button
            type="button"
            onClick={() => !paying && onClose()}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            disabled={!!paying}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5 sm:p-6">
          {disabledReason && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Almost ready to upgrade</p>
              <p className="mt-1">{disabledReason}</p>
            </div>
          )}
          {reason === 'categories' && (
            <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/80 p-3 text-sm text-sky-900">
              <p className="font-medium">Stay on your current plan with one category</p>
              <p className="mt-1 text-sky-800">
                Close this dialog and tap a different property type to replace your selection — no boost required for a single category.
              </p>
              <button
                type="button"
                onClick={() => !paying && onClose()}
                disabled={!!paying}
                className="mt-3 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-50 disabled:opacity-50"
              >
                Back to category selection
              </button>
            </div>
          )}
          {/* Package picker */}
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.values(BOOST_PACKAGES).map((pkg) => (
              <label
                key={pkg.id}
                className={`cursor-pointer rounded-xl border-2 p-3 text-left transition ${
                  packageId === pkg.id
                    ? 'border-primary-500 bg-primary-50/60 ring-2 ring-primary-100'
                    : 'border-gray-200 bg-white hover:border-primary-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-gray-900">{pkg.name}</span>
                  <input
                    type="radio"
                    name="boost-paywall-pkg"
                    checked={packageId === pkg.id}
                    onChange={() => setPackageId(pkg.id)}
                    className="h-4 w-4 text-primary-600"
                  />
                </div>
                <p className="mt-1 text-base font-semibold text-gray-900">{formatPrice(pkg.amount)}</p>
                <p className="text-xs text-gray-500">{pkg.days} days · {pkg.visibilityTier}</p>
                <ul className="mt-2 space-y-0.5 text-[11px] text-gray-600">
                  <li>{pkg.mediaUploads}</li>
                  <li>{pkg.categorySelection}</li>
                  <li>{pkg.displayPlacement}</li>
                </ul>
              </label>
            ))}
          </div>

          {/* Wallet pay */}
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Pay with Ad credit</p>
                <p className="text-xs text-emerald-800">
                  Balance:{' '}
                  <span className="font-semibold">
                    {walletLoading ? '…' : formatPrice(wallet?.balance ?? 0)}
                  </span>{' '}
                  · price {formatPrice(selected.amount)}
                </p>
              </div>
              <button
                type="button"
                disabled={paying !== null || !canPayWithWallet || walletLoading || isWalletDraftBlocked}
                onClick={payWithWallet}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paying === 'wallet'
                  ? 'Charging…'
                  : isWalletDraftBlocked
                    ? 'Locked'
                    : canPayWithWallet
                      ? 'Pay with Ad credit'
                      : 'Insufficient credit'}
              </button>
            </div>
            {!isWalletDraftBlocked && !canPayWithWallet && !walletLoading && wallet && (
              <p className="mt-2 text-xs text-emerald-800">
                You need {formatPrice(Math.max(0, selected.amount - wallet.balance))} more — top up below or pay with Paystack.
              </p>
            )}
          </div>

          {/* Coupon */}
          <form onSubmit={onRedeemCoupon} className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">Redeem a coupon to top up Ad credit</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Adds funds to your wallet — then click "Pay with Ad credit" above.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="ENTER COUPON CODE"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono uppercase tracking-wider text-gray-900"
                maxLength={32}
              />
              <button
                type="submit"
                disabled={couponBusy || !coupon.trim()}
                className="min-h-[40px] rounded-md border border-primary-300 bg-white px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50"
              >
                {couponBusy ? 'Redeeming…' : 'Redeem'}
              </button>
            </div>
            {couponMsg && (
              <p
                className={`mt-2 rounded p-2 text-xs ${
                  couponMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {couponMsg.text}
              </p>
            )}
          </form>

          {/* Paystack inline */}
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Pay with Paystack</p>
                <p className="text-xs text-gray-500">
                  Card / bank / transfer — opens in a secure overlay; you stay on this page.
                </p>
              </div>
              <button
                type="button"
                disabled={paying !== null}
                onClick={payWithPaystack}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {paying === 'paystack' ? 'Processing…' : `Pay ${formatPrice(selected.amount)}`}
              </button>
            </div>
          </div>

          {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          {info && <p className="mt-3 rounded bg-green-50 p-2 text-sm text-green-700">{info}</p>}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 p-3 text-right">
          <button
            type="button"
            onClick={() => !paying && onClose()}
            disabled={!!paying}
            className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
