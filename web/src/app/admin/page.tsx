import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import Listing from '@/models/Listing';
import Claim from '@/models/Claim';
import Link from 'next/link';

export default async function AdminPage() {
  await dbConnect();
  const [usersCount, listingsCount, pendingClaims] = await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Claim.countDocuments({ status: 'pending' }),
  ]);

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3">
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
    </div>
  );
}
