import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { ListingPackagesSection } from '@/components/listings/ListingPackagesSection';
import { MyListingsTable } from '@/components/listings/MyListingsTable';
import { LISTING_STATUS, USER_ROLES } from '@/lib/constants';

const PER_PAGE = 25;

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const sp = searchParams ? await searchParams : {};
  const page = Math.max(1, Math.min(500, parseInt(typeof sp?.page === 'string' ? sp.page : '1', 10) || 1));
  const skip = (page - 1) * PER_PAGE;

  await dbConnect();
  const ownerId = session.user.id;
  const [listings, total, activeListingCount, user] = await Promise.all([
    Listing.find({ createdBy: ownerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PER_PAGE)
      .select('title price status listingType rentPeriod images featured highlighted')
      .lean(),
    Listing.countDocuments({ createdBy: ownerId }),
    Listing.countDocuments({
      createdBy: ownerId,
      status: { $in: [LISTING_STATUS.DRAFT, LISTING_STATUS.ACTIVE, LISTING_STATUS.PAUSED] },
    }),
    User.findById(ownerId).select('role').lean(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

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
  const isBot = user?.role === USER_ROLES.BOT;
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
          {isBot && (
            <Link href="/dashboard/listings/import" className="btn-secondary w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center touch-manipulation">
              Import from WhatsApp
            </Link>
          )}
          <Link href="/listings/new" className="btn-primary w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center touch-manipulation">
            Add listing
          </Link>
        </div>
      </div>

      <ListingPackagesSection />

      <div className="mt-6">
        <p className="mb-3 text-sm text-gray-500">
          Showing {rows.length === 0 ? 0 : skip + 1}–{skip + rows.length} of {total} listing{total !== 1 ? 's' : ''}
          {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ''}
        </p>
        <MyListingsTable listings={rows} />
        {totalPages > 1 && (
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Listing pages">
            <PaginationLink href="/dashboard/listings" disabled={page <= 1} label="First" />
            <PaginationLink
              href={page <= 2 ? '/dashboard/listings' : `/dashboard/listings?page=${page - 1}`}
              disabled={page <= 1}
              label="Previous"
            />
            <span className="px-3 text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <PaginationLink
              href={page >= totalPages ? '#' : `/dashboard/listings?page=${page + 1}`}
              disabled={page >= totalPages}
              label="Next"
            />
            <PaginationLink
              href={page >= totalPages ? '#' : `/dashboard/listings?page=${totalPages}`}
              disabled={page >= totalPages}
              label="Last"
            />
          </nav>
        )}
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-400">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 touch-manipulation"
    >
      {label}
    </Link>
  );
}
