import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth-options';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import { formatPrice } from '@/lib/utils';
import { getWalletBalance } from '@/lib/wallet';

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  await dbConnect();
  const [payments, walletBalance] = await Promise.all([
    Payment.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(50).lean(),
    getWalletBalance(session.user.id),
  ]);

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Payment History</h1>
      <p className="mt-1 text-gray-600">Your listing boost, ad, and wallet payments.</p>

      <Link
        href="/dashboard/wallet"
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-white p-4 shadow-sm hover:border-primary-200 sm:p-5"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Ad credit balance</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">{formatPrice(walletBalance)}</p>
          <p className="mt-1 text-xs text-gray-500">Use Ad credit to pay for boosts and adverts.</p>
        </div>
        <span className="text-sm font-semibold text-primary-700">Top up / redeem coupon →</span>
      </Link>

      <p className="mt-4">
        <Link href="/dashboard/listings" className="text-primary-600 font-medium hover:underline">
          Upgrade individual listings from My Properties →
        </Link>
      </p>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Date</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Amount</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:table-cell">Purpose</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {payments.map((p) => (
              <tr key={p._id.toString()}>
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
  );
}
