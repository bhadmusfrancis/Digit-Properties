'use client';

import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import { WALLET_TOPUP_LIMITS } from '@/lib/constants';

type Tx = {
  _id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: string;
  balanceAfter: number;
  description?: string;
  createdAt: string;
};

const REASON_LABEL: Record<string, string> = {
  topup: 'Top-up',
  admin_credit: 'Admin credit',
  admin_debit: 'Admin debit',
  coupon_redemption: 'Coupon',
  boost_listing: 'Listing boost',
  user_ad: 'Advert',
  subscription_tier: 'Subscription',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

const PRESET_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

export function WalletPageClient({
  initialBalance,
  currency,
  initialTransactions,
  justToppedUp,
}: {
  initialBalance: number;
  currency: string;
  initialTransactions: Tx[];
  justToppedUp: boolean;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [transactions, setTransactions] = useState<Tx[]>(initialTransactions);
  const [refreshing, setRefreshing] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number | ''>(2000);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);

  const [coupon, setCoupon] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/me/wallet?limit=50');
      const data = await res.json();
      if (typeof data.balance === 'number') setBalance(data.balance);
      if (Array.isArray(data.transactions)) {
        setTransactions(
          data.transactions.map((t: Tx) => ({
            _id: String(t._id),
            amount: t.amount,
            type: t.type,
            reason: t.reason,
            balanceAfter: t.balanceAfter,
            description: t.description,
            createdAt: new Date(t.createdAt).toISOString(),
          }))
        );
      }
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (justToppedUp) {
      // Webhook may take a couple seconds to credit; refresh after a short delay too.
      const t = setTimeout(refresh, 2500);
      return () => clearTimeout(t);
    }
  }, [justToppedUp]);

  const startTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopupError(null);
    const amount = Number(topupAmount);
    if (!Number.isFinite(amount) || amount < WALLET_TOPUP_LIMITS.MIN || amount > WALLET_TOPUP_LIMITS.MAX) {
      setTopupError(
        `Amount must be between ${formatPrice(WALLET_TOPUP_LIMITS.MIN)} and ${formatPrice(WALLET_TOPUP_LIMITS.MAX)}.`
      );
      return;
    }
    setTopupLoading(true);
    try {
      const res = await fetch('/api/me/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start top-up');
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      throw new Error('No payment link returned');
    } catch (err) {
      setTopupError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setTopupLoading(false);
    }
  };

  const redeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponMsg(null);
    if (!coupon.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch('/api/me/wallet/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponMsg({ ok: false, text: data.error || 'Failed' });
      } else {
        setCouponMsg({
          ok: true,
          text: `${formatPrice(data.amountCredited)} added to your wallet.`,
        });
        setBalance(data.balance);
        setCoupon('');
        refresh();
      }
    } catch {
      setCouponMsg({ ok: false, text: 'Failed to redeem coupon' });
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <div>
      {justToppedUp && (
        <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-800">
          Top-up received. Your wallet balance will refresh shortly. Click refresh below if the new amount is not visible yet.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Available balance</p>
            <p className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">{formatPrice(balance)}</p>
            <p className="mt-1 text-xs text-gray-500">Currency: {currency}</p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="text-sm font-medium text-primary-700 hover:underline disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Top up via Paystack */}
        <form
          onSubmit={startTopup}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="text-base font-semibold text-gray-900">Top up with Paystack</h2>
          <p className="mt-1 text-sm text-gray-600">
            Add funds to your Ad credit wallet. You can use the balance to pay for listing boosts and adverts.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setTopupAmount(a)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  topupAmount === a
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 text-gray-700 hover:border-primary-300'
                }`}
              >
                {formatPrice(a)}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Amount (NGN)
            <input
              type="number"
              min={WALLET_TOPUP_LIMITS.MIN}
              max={WALLET_TOPUP_LIMITS.MAX}
              step={100}
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
              required
            />
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Min {formatPrice(WALLET_TOPUP_LIMITS.MIN)} · Max {formatPrice(WALLET_TOPUP_LIMITS.MAX)}
          </p>
          {topupError && (
            <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{topupError}</p>
          )}
          <button
            type="submit"
            disabled={topupLoading}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {topupLoading ? 'Redirecting…' : 'Top up with Paystack'}
          </button>
        </form>

        {/* Redeem a coupon */}
        <form
          onSubmit={redeemCoupon}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="text-base font-semibold text-gray-900">Redeem a coupon</h2>
          <p className="mt-1 text-sm text-gray-600">
            Got a coupon code? Enter it below to add free Ad credit to your wallet.
          </p>
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Coupon code
            <input
              type="text"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono uppercase text-gray-900 tracking-wider"
              maxLength={32}
            />
          </label>
          {couponMsg && (
            <p
              className={`mt-2 rounded p-2 text-sm ${
                couponMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {couponMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={couponLoading || !coupon.trim()}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md border border-primary-300 bg-white px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
          >
            {couponLoading ? 'Redeeming…' : 'Redeem coupon'}
          </button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Recent activity</h2>
        <div className="mt-3 overflow-x-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Type</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:table-cell">Details</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500 sm:px-4">Amount</th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 md:table-cell">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {transactions.map((t) => (
                <tr key={t._id}>
                  <td className="px-3 py-3 text-sm text-gray-600 sm:px-4">
                    {new Date(t.createdAt).toLocaleString('en-NG', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700 sm:px-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        t.type === 'credit'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {REASON_LABEL[t.reason] ?? t.reason}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-gray-600 sm:table-cell">
                    {t.description || '—'}
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-sm font-semibold sm:px-4 ${
                      t.type === 'credit' ? 'text-green-700' : 'text-gray-900'
                    }`}
                  >
                    {t.type === 'credit' ? '+' : '−'}
                    {formatPrice(t.amount)}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-sm text-gray-600 md:table-cell">
                    {formatPrice(t.balanceAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && (
            <div className="py-12 text-center text-gray-500">No wallet activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
