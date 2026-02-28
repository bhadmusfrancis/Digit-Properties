import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import { formatPrice } from '@/lib/utils';

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  await dbConnect();
  const payments = await Payment.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
      <p className="mt-1 text-gray-600">Your boost and ad payments.</p>
      <p className="mt-4">
        <Link href="/dashboard/payments/plans" className="text-primary-600 font-medium hover:underline">
          Upgrade your listing plan (Gold / Premium) →
        </Link>
      </p>
      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Purpose</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {payments.map((p) => (
              <tr key={p._id.toString()}>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(p.createdAt).toLocaleDateString('en-NG')}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatPrice(p.amount)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                  {p.purpose?.replace('_', ' ')}
                </td>
                <td className="px-4 py-3">
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
