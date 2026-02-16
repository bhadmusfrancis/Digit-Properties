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
    <div className="grid gap-6 sm:grid-cols-3">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900">Users</h3>
        <p className="mt-2 text-3xl font-bold text-primary-600">{usersCount}</p>
        <Link href="/admin/users" className="mt-2 text-sm text-primary-600 hover:underline">
          Manage →
        </Link>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900">Listings</h3>
        <p className="mt-2 text-3xl font-bold text-primary-600">{listingsCount}</p>
        <Link href="/admin/listings" className="mt-2 text-sm text-primary-600 hover:underline">
          Manage →
        </Link>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900">Pending Claims</h3>
        <p className="mt-2 text-3xl font-bold text-amber-600">{pendingClaims}</p>
        <Link href="/admin/claims" className="mt-2 text-sm text-primary-600 hover:underline">
          Review →
        </Link>
      </div>
    </div>
  );
}
