import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { MyListingsTable } from '@/components/listings/MyListingsTable';
import { CompactPagination } from '@/components/ui/CompactPagination';
import { USER_ROLES } from '@/lib/constants';
import { parseListingSortFromSearchParams, buildListingListQuery } from '@/lib/listing-list-query';
import { fetchMyListingsPage } from '@/lib/listing-list-server-sort';

const PER_PAGE = 25;

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; sort?: string; order?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const sp = searchParams ? await searchParams : {};
  const rawPage = Math.max(1, Math.min(500, parseInt(typeof sp?.page === 'string' ? sp.page : '1', 10) || 1));
  const { sortKey, sortAsc } = parseListingSortFromSearchParams(sp);

  await dbConnect();
  const ownerId = session.user.id;
  const total = await Listing.countDocuments({ createdBy: ownerId });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(totalPages, rawPage);
  const skip = (page - 1) * PER_PAGE;

  const [listings, user] = await Promise.all([
    fetchMyListingsPage(ownerId, sortKey, sortAsc, skip, PER_PAGE),
    User.findById(ownerId).select('role').lean(),
  ]);

  const q = (p: number) => buildListingListQuery(p, sortKey, sortAsc);

  const rows = listings.map((l) => ({
    _id: String(l._id),
    title: l.title,
    price: Number(l.price),
    status: String(l.status),
    listingType: String(l.listingType),
    propertyType: typeof l.propertyType === 'string' ? l.propertyType : 'apartment',
    rentPeriod: l.rentPeriod != null ? String(l.rentPeriod) : undefined,
    createdAt: l.createdAt ? new Date(l.createdAt as unknown as Date).toISOString() : undefined,
    images: Array.isArray(l.images)
      ? l.images.map((img: { url?: string; public_id?: string }) => ({ url: img?.url ?? '', public_id: img?.public_id ?? '' }))
      : [],
    videos: Array.isArray(l.videos)
      ? l.videos.map((v: { url?: string; public_id?: string }) => ({ url: v?.url ?? '', public_id: v?.public_id ?? '' }))
      : [],
    featured: Boolean(l.featured),
    highlighted: Boolean(l.highlighted),
    soldAt: l.soldAt ? new Date(l.soldAt as unknown as Date).toISOString() : undefined,
    rentedAt: l.rentedAt ? new Date(l.rentedAt as unknown as Date).toISOString() : undefined,
  }));

  const isBot = user?.role === USER_ROLES.BOT;

  return (
    <div>
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

      <div className="mt-6">
        <p className="mb-3 text-sm text-gray-500">
          Showing {rows.length === 0 ? 0 : skip + 1}–{skip + rows.length} of {total} listing{total !== 1 ? 's' : ''}
          {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ''}
        </p>
        <MyListingsTable
          listings={rows}
          sortKey={sortKey}
          sortAsc={sortAsc}
          basePath="/dashboard/listings"
        />
        {totalPages > 1 && (
          <CompactPagination
            className="mt-6"
            page={page}
            totalPages={totalPages}
            previousHref={`/dashboard/listings${q(Math.max(1, page - 1))}`}
            nextHref={`/dashboard/listings${q(Math.min(totalPages, page + 1))}`}
          />
        )}
      </div>
    </div>
  );
}
