import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { formatPrice } from '@/lib/utils';
import { MyListingActions } from '@/components/listings/MyListingActions';

export default async function MyListingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  await dbConnect();
  const listings = await Listing.find({ createdBy: session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
        <Link href="/listings/new" className="btn-primary">
          Add listing
        </Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {listings.map((l) => (
              <tr key={l._id.toString()}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{l.title}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatPrice(l.price, l.listingType === 'rent' ? l.rentPeriod : undefined)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      l.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : l.status === 'draft'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <MyListingActions listingId={String(l._id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {listings.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            No listings yet.{' '}
            <Link href="/listings/new" className="text-primary-600 hover:underline">
              Create one
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
