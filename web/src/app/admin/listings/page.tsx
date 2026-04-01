import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import Link from 'next/link';
import { parseListingSortFromSearchParams, buildListingListQuery } from '@/lib/listing-list-query';
import { fetchAdminListingsPage } from '@/lib/listing-list-server-sort';
import { CompactPagination } from '@/components/ui/CompactPagination';
import { AdminListingsTable } from './AdminListingsTable';
import { FixVictoriaIslandTitlesButton } from './FixVictoriaIslandTitlesButton';

const PER_PAGE = 50;

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; sort?: string; order?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const rawPage = Math.max(1, parseInt(typeof sp?.page === 'string' ? sp.page : '1', 10) || 1);
  const { sortKey, sortAsc } = parseListingSortFromSearchParams(sp);

  await dbConnect();
  const total = await Listing.countDocuments({});
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(totalPages, rawPage);
  const skip = (page - 1) * PER_PAGE;

  const [listings, users] = await Promise.all([
    fetchAdminListingsPage(sortKey, sortAsc, skip, PER_PAGE),
    User.find({}).select('_id name email').sort({ name: 1 }).limit(500).lean(),
  ]);

  const q = (p: number) => buildListingListQuery(p, sortKey, sortAsc);

  const userList = users.map((u) => ({
    _id: String(u._id),
    name: typeof u.name === 'string' ? u.name : undefined,
    email: typeof u.email === 'string' ? u.email : undefined,
  }));

  const listingRows = listings.map((l) => {
    const rawCb = l.createdBy;
    let createdBy: unknown = null;
    if (rawCb && typeof rawCb === 'object' && rawCb !== null && '_id' in rawCb) {
      const cb = rawCb as { _id: unknown; name?: string; email?: string };
      createdBy = {
        _id: String(cb._id),
        name: cb.name,
        email: cb.email,
      };
    } else if (rawCb != null) {
      createdBy = String(rawCb);
    }

    const images = Array.isArray(l.images)
      ? l.images.map((img: { url?: unknown; public_id?: unknown }) => ({
          url: typeof img?.url === 'string' ? img.url : '',
          public_id: img?.public_id != null ? String(img.public_id) : '',
        }))
      : [];
    const videos = Array.isArray(l.videos)
      ? l.videos.map((v: { url?: unknown; public_id?: unknown }) => ({
          url: typeof v?.url === 'string' ? v.url : '',
          public_id: v?.public_id != null ? String(v.public_id) : '',
        }))
      : [];
    const loc = l.location && typeof l.location === 'object'
      ? (l.location as { address?: unknown; suburb?: unknown; city?: unknown; state?: unknown })
      : undefined;
    const locationLine = [
      typeof loc?.address === 'string' ? loc.address : '',
      typeof loc?.suburb === 'string' ? loc.suburb : '',
      typeof loc?.city === 'string' ? loc.city : '',
      typeof loc?.state === 'string' ? loc.state : '',
    ].filter(Boolean).join(', ');

    return {
      _id: String(l._id),
      title: typeof l.title === 'string' ? l.title : '',
      price: typeof l.price === 'number' ? l.price : Number(l.price) || 0,
      status: typeof l.status === 'string' ? l.status : String(l.status ?? ''),
      listingType: typeof l.listingType === 'string' ? l.listingType : String(l.listingType ?? ''),
      propertyType: typeof l.propertyType === 'string' ? l.propertyType : 'apartment',
      rentPeriod:
        l.rentPeriod != null && typeof l.rentPeriod === 'string' ? l.rentPeriod : undefined,
      createdAt: l.createdAt ? new Date(l.createdAt as unknown as Date).toISOString() : undefined,
      locationLine,
      images,
      videos,
      featured: Boolean(l.featured),
      highlighted: Boolean(l.highlighted),
      boostPackage: typeof (l as { boostPackage?: unknown }).boostPackage === 'string'
        ? (l as { boostPackage?: string }).boostPackage
        : undefined,
      createdBy,
    };
  });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Admin Listings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage, assign, and moderate all platform listings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FixVictoriaIslandTitlesButton />
          <Link
            href="/listings/new"
            className="btn-primary min-h-[44px] w-full touch-manipulation sm:w-auto"
          >
            Add listing
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total listings</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Showing</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {listingRows.length === 0 ? '0' : `${skip + 1}-${skip + listingRows.length}`}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Page</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {page} / {totalPages}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <AdminListingsTable
          listings={listingRows}
          users={userList}
          sortKey={sortKey}
          sortAsc={sortAsc}
          basePath="/admin/listings"
        />
      </div>
      {totalPages > 1 && (
        <CompactPagination
          className="mt-6"
          page={page}
          totalPages={totalPages}
          previousHref={`/admin/listings${q(Math.max(1, page - 1))}`}
          nextHref={`/admin/listings${q(Math.min(totalPages, page + 1))}`}
        />
      )}
      <p className="mt-6">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}

