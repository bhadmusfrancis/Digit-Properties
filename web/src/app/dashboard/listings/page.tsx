import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { ListingPackagesSection } from '@/components/listings/ListingPackagesSection';
import { MyListingsTable } from '@/components/listings/MyListingsTable';

export default async function MyListingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  await dbConnect();
  const listings = await Listing.find({ createdBy: session.user.id })
    .sort({ createdAt: -1 })
    .select('title price status listingType rentPeriod images featured highlighted')
    .lean();

  const rows = listings.map((l) => ({
    _id: String(l._id),
    title: l.title,
    price: Number(l.price),
    status: String(l.status),
    listingType: String(l.listingType),
    rentPeriod: l.rentPeriod != null ? String(l.rentPeriod) : undefined,
    images: Array.isArray(l.images)
      ? l.images.map((img: { url?: string; public_id?: string }) => ({ url: img?.url ?? '', public_id: img?.public_id ?? '' }))
      : [],
    featured: Boolean(l.featured),
    highlighted: Boolean(l.highlighted),
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Properties</h1>
        <Link href="/listings/new" className="btn-primary">
          Add listing
        </Link>
      </div>

      <ListingPackagesSection />

      <div className="mt-6">
        <MyListingsTable listings={rows} />
      </div>
    </div>
  );
}
