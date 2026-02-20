import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

export default async function AdminListingsPage() {
  await dbConnect();
  void User;
  const listings = await Listing.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('createdBy', 'name email')
    .lean();

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Listings</h2>
      <p className="mt-1 text-sm text-gray-500">{listings.length} listings (max 100 shown)</p>
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created by</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {listings.map((l) => (
              <tr key={l._id.toString()}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">{l.title}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatPrice(l.price, l.listingType === 'rent' ? l.rentPeriod : undefined)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      l.status === 'active' ? 'bg-green-100 text-green-800' : l.status === 'draft' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {l.createdBy && typeof l.createdBy === 'object'
                    ? (l.createdBy as { name?: string }).name ?? (l.createdBy as { email?: string }).email ?? '—'
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/listings/${l._id}`} className="text-primary-600 hover:underline">
                    View
                  </Link>
                  {' · '}
                  <Link href={`/listings/${l._id}/edit`} className="text-primary-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {listings.length === 0 && (
          <div className="py-12 text-center text-gray-500">No listings yet.</div>
        )}
      </div>
      <p className="mt-4">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}
