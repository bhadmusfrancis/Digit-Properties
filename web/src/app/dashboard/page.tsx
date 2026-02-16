import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import Claim from '@/models/Claim';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  await dbConnect();
  const [listingsCount, claimsCount] = await Promise.all([
    Listing.countDocuments({ createdBy: session.user.id }),
    Claim.countDocuments({ userId: session.user.id, status: 'pending' }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-gray-600">Welcome back, {session.user?.name}.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/listings" className="card p-6 hover:shadow-md">
          <h3 className="font-semibold text-gray-900">My Listings</h3>
          <p className="mt-2 text-3xl font-bold text-primary-600">{listingsCount}</p>
          <p className="mt-1 text-sm text-gray-500">View and manage your listings</p>
        </Link>
        <Link href="/dashboard/claims" className="card p-6 hover:shadow-md">
          <h3 className="font-semibold text-gray-900">Pending Claims</h3>
          <p className="mt-2 text-3xl font-bold text-primary-600">{claimsCount}</p>
          <p className="mt-1 text-sm text-gray-500">Track your property claims</p>
        </Link>
        <Link href="/listings/new" className="card flex flex-col justify-center p-6 hover:shadow-md">
          <h3 className="font-semibold text-gray-900">List a property</h3>
          <p className="mt-2 text-sm text-gray-500">Create a new listing</p>
          <span className="mt-4 text-primary-600 font-medium">+ Add listing →</span>
        </Link>
      </div>
    </div>
  );
}
