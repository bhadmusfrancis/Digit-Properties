import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import Listing from '@/models/Listing';
import Claim from '@/models/Claim';
import CouponCode from '@/models/CouponCode';
import PageView from '@/models/PageView';
import Link from 'next/link';

export default async function AdminPage() {
  await dbConnect();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  since.setUTCHours(0, 0, 0, 0);

  const [usersCount, listingsCount, pendingClaims, activeCoupons, viewsLast30Days, uniqueVisitors30] =
    await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Claim.countDocuments({ status: 'pending' }),
    CouponCode.countDocuments({ active: true }),
    PageView.countDocuments({ createdAt: { $gte: since } }),
    PageView.distinct('sessionId', { createdAt: { $gte: since } }).then((ids) => ids.length),
  ]);

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Link href="/admin/analytics" className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6 hover:shadow-md transition-shadow min-h-[44px] flex flex-col">
        <h3 className="font-semibold text-gray-900">Traffic (30d)</h3>
        <p className="mt-2 text-3xl font-bold text-indigo-600">{viewsLast30Days.toLocaleString('en-NG')}</p>
        <p className="mt-1 text-sm text-gray-500">{uniqueVisitors30.toLocaleString('en-NG')} unique visitors</p>
        <span className="mt-2 text-sm text-primary-600 hover:underline">View report →</span>
      </Link>
      <Link href="/admin/users" className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6 hover:shadow-md transition-shadow min-h-[44px] flex flex-col">
        <h3 className="font-semibold text-gray-900">Users</h3>
        <p className="mt-2 text-3xl font-bold text-primary-600">{usersCount}</p>
        <span className="mt-2 text-sm text-primary-600 hover:underline">Manage →</span>
      </Link>
      <Link href="/admin/listings" className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6 hover:shadow-md transition-shadow min-h-[44px] flex flex-col">
        <h3 className="font-semibold text-gray-900">Listings</h3>
        <p className="mt-2 text-3xl font-bold text-primary-600">{listingsCount}</p>
        <span className="mt-2 text-sm text-primary-600 hover:underline">Manage →</span>
      </Link>
      <Link href="/admin/claims" className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6 hover:shadow-md transition-shadow min-h-[44px] flex flex-col">
        <h3 className="font-semibold text-gray-900">Pending Claims</h3>
        <p className="mt-2 text-3xl font-bold text-amber-600">{pendingClaims}</p>
        <span className="mt-2 text-sm text-primary-600 hover:underline">Review →</span>
      </Link>
      <Link href="/admin/coupons" className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6 hover:shadow-md transition-shadow min-h-[44px] flex flex-col">
        <h3 className="font-semibold text-gray-900">Active Coupons</h3>
        <p className="mt-2 text-3xl font-bold text-emerald-600">{activeCoupons}</p>
        <span className="mt-2 text-sm text-primary-600 hover:underline">Manage →</span>
      </Link>
    </div>
  );
}
