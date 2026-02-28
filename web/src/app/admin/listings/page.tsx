import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import Link from 'next/link';
import { AdminListingsTable } from './AdminListingsTable';

export default async function AdminListingsPage() {
  await dbConnect();
  const [listings, users] = await Promise.all([
    Listing.find({}).sort({ createdAt: -1 }).limit(100).populate('createdBy', 'name email').select('title price status listingType rentPeriod images featured highlighted createdBy').lean(),
    User.find({}).select('_id name email').sort({ name: 1 }).limit(500).lean(),
  ]);
  const userList = users.map((u) => ({ _id: String(u._id), name: u.name, email: u.email }));
  const listingRows = listings.map((l) => ({
    ...l,
    _id: String(l._id),
    createdBy: l.createdBy,
  }));

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Listings</h2>
      <p className="mt-1 text-sm text-gray-500">{listings.length} listings (max 100 shown)</p>
      <div className="mt-4">
        <AdminListingsTable listings={listingRows} users={userList} />
      </div>
      <p className="mt-4">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}
