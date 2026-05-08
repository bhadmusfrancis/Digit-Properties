import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth-options';
import { dbConnect } from '@/lib/db';
import WalletTransaction from '@/models/WalletTransaction';
import { getOrCreateWallet } from '@/lib/wallet';
import { WalletPageClient } from './WalletPageClient';

export const metadata = {
  title: 'Ad Credit Wallet | Digit Properties',
  description: 'Top up your Ad credit balance, redeem coupons, and pay for boosts and ads.',
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=/dashboard/wallet');

  await dbConnect();
  const wallet = await getOrCreateWallet(session.user.id);
  const transactions = await WalletTransaction.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const sp = await searchParams;
  const justToppedUp = sp?.topup === 'success';

  const initialTransactions = transactions.map((t) => ({
    _id: t._id.toString(),
    amount: t.amount,
    type: t.type,
    reason: t.reason,
    balanceAfter: t.balanceAfter,
    description: t.description,
    createdAt: new Date(t.createdAt).toISOString(),
  }));

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Ad Credit Wallet</h1>
          <p className="mt-1 text-gray-600">
            Use your balance to pay for listing boosts and ads — instantly, no card needed.
          </p>
        </div>
        <Link href="/dashboard/payments" className="text-sm text-primary-600 hover:underline">
          Payment history →
        </Link>
      </div>

      <WalletPageClient
        initialBalance={wallet.balance}
        currency={wallet.currency || 'NGN'}
        initialTransactions={initialTransactions}
        justToppedUp={justToppedUp}
      />
    </div>
  );
}
