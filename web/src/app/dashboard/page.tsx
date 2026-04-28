import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth-options';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import Claim from '@/models/Claim';
import ListingProfessionalOffer from '@/models/ListingProfessionalOffer';
import { toFirstName } from '@/lib/display-name';
import mongoose from 'mongoose';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  await dbConnect();
  const uid = new mongoose.Types.ObjectId(session.user.id);
  const [listingsCount, claimsCount, offersCount] = await Promise.all([
    Listing.countDocuments({ createdBy: session.user.id }),
    Claim.countDocuments({ userId: session.user.id, status: 'pending' }),
    ListingProfessionalOffer.countDocuments({ $or: [{ buyerId: uid }, { sellerId: uid }] }),
  ]);
  const firstName = toFirstName(undefined, session.user?.name, 'there');

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Dashboard</h1>
      <p className="mt-1 text-gray-600">Welcome back, {firstName}.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <Link href="/dashboard/listings" className="card flex min-h-[44px] flex-col p-5 hover:shadow-md sm:p-6">
          <h3 className="font-semibold text-gray-900">My Properties</h3>
          <p className="mt-2 text-3xl font-bold text-primary-600">{listingsCount}</p>
          <p className="mt-1 text-sm text-gray-500">View and manage your listings</p>
        </Link>
        <Link href="/dashboard/claims" className="card flex min-h-[44px] flex-col p-5 hover:shadow-md sm:p-6">
          <h3 className="font-semibold text-gray-900">Pending Claims</h3>
          <p className="mt-2 text-3xl font-bold text-primary-600">{claimsCount}</p>
          <p className="mt-1 text-sm text-gray-500">Track your property claims</p>
        </Link>
        <Link href="/dashboard/offers" className="card flex min-h-[44px] flex-col p-5 hover:shadow-md sm:p-6">
          <h3 className="font-semibold text-gray-900">Offers</h3>
          <p className="mt-2 text-3xl font-bold text-primary-600">{offersCount}</p>
          <p className="mt-1 text-sm text-gray-500">Manage buyer/seller offer threads</p>
        </Link>
        <Link href="/listings/new" className="card flex min-h-[44px] flex-col justify-center p-5 hover:shadow-md sm:p-6">
          <h3 className="font-semibold text-gray-900">Sell or Rent a property</h3>
          <p className="mt-2 text-sm text-gray-500">Create a new listing</p>
          <span className="mt-4 text-primary-600 font-medium">+ Add listing →</span>
        </Link>
      </div>
    </div>
  );
}
