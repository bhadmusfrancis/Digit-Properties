'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { formatPrice } from '@/lib/utils';
import { WalletPageClient } from '../wallet/WalletPageClient';

type PaymentRow = {
  _id: string;
  amount: number;
  purpose?: string;
  gateway?: string;
  status: string;
  createdAt: string;
};

type Tab = 'ad-credit' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ad-credit', label: 'Ad Credit' },
  { id: 'history', label: 'Payment history' },
];

export function PaymentsFinanceTabs({
  walletBalance,
  currency,
  initialTransactions,
  justToppedUp,
  payments,
}: {
  walletBalance: number;
  currency: string;
  initialTransactions: Parameters<typeof WalletPageClient>[0]['initialTransactions'];
  justToppedUp: boolean;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'history' ? 'history' : 'ad-credit';

  const setTab = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'ad-credit') {
        params.delete('tab');
      } else {
        params.set('tab', next);
      }
      const q = params.toString();
      router.replace(q ? `/dashboard/payments?${q}` : '/dashboard/payments', { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Payments</h1>
      <p className="mt-1 text-gray-600">Ad credit wallet, top-ups, and payment history.</p>

      <div
        className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1"
        role="tablist"
        aria-label="Payments sections"
      >
        {TABS.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`min-h-[44px] flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-white text-primary-700 shadow-sm ring-1 ring-primary-200/60'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
              {id === 'ad-credit' && (
                <span className={`ml-2 text-xs font-bold ${active ? 'text-primary-600' : 'text-gray-500'}`}>
                  {formatPrice(walletBalance)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'ad-credit' ? (
        <div className="mt-6" role="tabpanel">
          <WalletPageClient
            initialBalance={walletBalance}
            currency={currency}
            initialTransactions={initialTransactions}
            justToppedUp={justToppedUp}
          />
        </div>
      ) : (
        <div className="mt-6" role="tabpanel">
          <p className="mb-4 text-sm text-gray-600">
            Card and gateway payments for boosts, ads, and subscriptions.{' '}
            <Link href="/dashboard/listings" className="font-medium text-primary-600 hover:underline">
              Upgrade listings from My Properties →
            </Link>
          </p>
          <div className="rounded-lg border border-gray-200 bg-white shadow">
            <table className="w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Amount</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:table-cell">
                    Purpose
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td className="px-3 py-3 text-sm text-gray-600 sm:px-4">
                      {new Date(p.createdAt).toLocaleDateString('en-NG')}
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 sm:px-4">{formatPrice(p.amount)}</td>
                    <td className="hidden px-3 py-3 text-sm capitalize text-gray-600 sm:table-cell sm:px-4">
                      {p.purpose?.replace(/_/g, ' ')}
                      {p.gateway === 'wallet' && (
                        <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                          Wallet
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          p.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : p.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payments.length === 0 && (
              <div className="py-12 text-center text-gray-500">No payments yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
