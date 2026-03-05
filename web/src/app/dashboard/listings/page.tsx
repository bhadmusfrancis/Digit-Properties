import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { ListingPackagesSection } from '@/components/listings/ListingPackagesSection';
import { MyListingsTable } from '@/components/listings/MyListingsTable';
import { USER_ROLES } from '@/lib/constants';

export default async function MyListingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  await dbConnect();
  const [listings, user] = await Promise.all([
    Listing.find({ createdBy: session.user.id })
      .sort({ createdAt: -1 })
      .select('title price status listingType rentPeriod images featured highlighted')
      .lean(),
    User.findById(session.user.id).select('role').lean(),
  ]);

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

  const isGuest = user?.role === USER_ROLES.GUEST;
  const activeListingCount = rows.filter((r) => ['draft', 'active', 'paused'].includes(r.status)).length;
  const guestLimit = 5;
  const atOrNearGuestLimit = isGuest && activeListingCount >= guestLimit;

  return (
    <div>
      {atOrNearGuestLimit && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">You&apos;ve reached the limit of {guestLimit} listings.</p>
          <p className="mt-1">Verify your account to add more listings and unlock more features.</p>
          <Link href="/dashboard/profile" className="mt-2 inline-block font-medium text-amber-900 underline hover:no-underline">
            Verify my account →
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">My Properties</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/listings/import" className="btn-secondary w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center touch-manipulation">
            Import from WhatsApp
          </Link>
          <Link href="/listings/new" className="btn-primary w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center touch-manipulation">
            Add listing
          </Link>
        </div>
      </div>

      <ListingPackagesSection />

      <div className="mt-6">
        <MyListingsTable listings={rows} />
      </div>
    </div>
  );
}
