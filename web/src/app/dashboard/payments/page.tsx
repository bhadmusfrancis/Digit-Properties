import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import WalletTransaction from '@/models/WalletTransaction';
import { getOrCreateWallet } from '@/lib/wallet';
import { PaymentsFinanceTabs } from './PaymentsFinanceTabs';

export const metadata = {
  title: 'Payments | Digit Properties',
  description: 'Ad credit wallet, top-ups, coupons, and payment history.',
};

function PaymentsTabsFallback() {
  return (
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Payments</h1>
      <p className="mt-1 text-gray-600">Loading…</p>
    </div>
  );
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; topup?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const sp = await searchParams;
  const justToppedUp = sp?.topup === 'success';

  await dbConnect();
  const [wallet, transactions, payments] = await Promise.all([
    getOrCreateWallet(session.user.id),
    WalletTransaction.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(50).lean(),
    Payment.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  const initialTransactions = transactions.map((t) => ({
    _id: t._id.toString(),
    amount: t.amount,
    type: t.type as 'credit' | 'debit',
    reason: t.reason,
    balanceAfter: t.balanceAfter,
    description: t.description,
    createdAt: new Date(t.createdAt).toISOString(),
  }));

  const paymentRows = payments.map((p) => ({
    _id: p._id.toString(),
    amount: Number(p.amount),
    purpose: p.purpose != null ? String(p.purpose) : undefined,
    gateway: p.gateway != null ? String(p.gateway) : undefined,
    status: String(p.status),
    createdAt: new Date(p.createdAt).toISOString(),
  }));

  return (
    <Suspense fallback={<PaymentsTabsFallback />}>
      <PaymentsFinanceTabs
        walletBalance={wallet.balance}
        currency={wallet.currency || 'NGN'}
        initialTransactions={initialTransactions}
        justToppedUp={justToppedUp}
        payments={paymentRows}
      />
    </Suspense>
  );
}
