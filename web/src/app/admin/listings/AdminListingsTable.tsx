'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { formatPrice } from '@/lib/utils';
import { type ListingSortKey, cycleListingSort } from '@/lib/sort-listing-rows';
import { buildListingListQuery } from '@/lib/listing-list-query';
import { getListingDisplayImage, isDefaultListingImageUrl } from '@/lib/listing-default-image';
import { SortColumnHeader } from '@/components/listings/SortColumnHeader';
import { AdminListingActions } from './AdminListingActions';

type User = { _id: string; name?: string; email?: string };
type Listing = {
  _id: string;
  title: string;
  locationLine?: string;
  price: number;
  status: string;
  listingType: string;
  createdAt?: string;
  propertyType: string;
  rentPeriod?: string;
  images?: { url?: string; public_id?: string }[];
  videos?: { url?: string; public_id?: string }[];
  featured?: boolean;
  highlighted?: boolean;
  createdBy: unknown;
};

export function AdminListingsTable({
  listings,
  users,
  sortKey,
  sortAsc,
  basePath,
}: {
  listings: Listing[];
  users: User[];
  sortKey: ListingSortKey;
  sortAsc: boolean;
  basePath: string;
}) {
  const router = useRouter();

  // Must be deterministic between server-render and browser hydration.
  // Use UTC date only (YYYY-MM-DD) to avoid timezone/locale mismatches.
  const formatCreatedAt = (createdAt?: string) => {
    if (!createdAt) return '—';
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
  };

  const applySort = useCallback(
    (key: Exclude<ListingSortKey, 'default'>) => {
      const next = cycleListingSort(sortKey, sortAsc, key);
      router.push(`${basePath}${buildListingListQuery(1, next.sortKey, next.sortAsc)}`);
    },
    [basePath, router, sortAsc, sortKey]
  );

  const resetSort = useCallback(() => {
    router.push(`${basePath}${buildListingListQuery(1, 'default', true)}`);
  }, [basePath, router]);

  const thumb = (l: Listing) => {
    const url = getListingDisplayImage(l.images, l.propertyType, l.videos);
    if (url && !isDefaultListingImageUrl(url)) {
      return <img src={url} alt="" className="h-12 w-16 rounded object-cover bg-gray-100" />;
    }
    return <div className="h-12 w-16 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">No img</div>;
  };

  const createdByLabel = (l: Listing) => {
    if (l.createdBy && typeof l.createdBy === 'object' && '_id' in l.createdBy) {
      const o = l.createdBy as { name?: string; email?: string };
      return o.name ?? o.email ?? '—';
    }
    return '—';
  };
  const createdById = (l: Listing) => {
    if (l.createdBy && typeof l.createdBy === 'object' && '_id' in l.createdBy)
      return String((l.createdBy as { _id: unknown })._id);
    return String(l.createdBy);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow -mx-1 px-1 sm:mx-0 sm:px-0">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-100 bg-gray-50/80 px-2 py-2 sm:px-3">
        <span className="mr-auto text-xs text-gray-500">Sort by column headers</span>
        {sortKey !== 'default' && (
          <button type="button" onClick={resetSort} className="text-xs font-medium text-primary-600 hover:underline">
            Reset order
          </button>
        )}
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <SortColumnHeader
              className="px-2 py-3 text-left w-16 sm:w-20 sm:px-3"
              label="Image"
              active={sortKey === 'image'}
              ascending={sortAsc}
              onClick={() => applySort('image')}
            />
            <SortColumnHeader
              className="px-2 py-3 text-left sm:px-4"
              label="Title"
              active={sortKey === 'title'}
              ascending={sortAsc}
              onClick={() => applySort('title')}
            />
            <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Address</th>
            <SortColumnHeader
              className="px-2 py-3 text-left sm:px-4 whitespace-nowrap"
              label="Price"
              active={sortKey === 'price'}
              ascending={sortAsc}
              onClick={() => applySort('price')}
            />
            <SortColumnHeader
              className="px-2 py-3 text-left sm:px-4"
              label="Status"
              active={sortKey === 'status'}
              ascending={sortAsc}
              onClick={() => applySort('status')}
            />
            <SortColumnHeader
              className="px-2 py-3 text-left sm:px-4 whitespace-nowrap"
              label="Date"
              active={sortKey === 'date'}
              ascending={sortAsc}
              onClick={() => applySort('date')}
            />
            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created by</th>
            <th className="px-2 py-3 text-right text-xs font-medium uppercase text-gray-500 sm:px-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {listings.map((l) => (
            <tr
              key={l._id}
              onClick={() => router.push(`/listings/${l._id}`)}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                {thumb(l)}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] sm:max-w-xs truncate">{l.title}</td>
              <td className="px-4 py-3 text-sm text-gray-600 max-w-[260px] truncate" title={l.locationLine || ''}>
                {l.locationLine || '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                {formatPrice(l.price, l.listingType === 'rent' ? l.rentPeriod : undefined)}
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    l.status === 'active' ? 'bg-green-100 text-green-800' : l.status === 'draft' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {l.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                {formatCreatedAt(l.createdAt)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{createdByLabel(l)}</td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <AdminListingActions
                  listingId={l._id}
                  status={l.status}
                  createdById={createdById(l)}
                  createdByLabel={createdByLabel(l)}
                  users={users}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {listings.length === 0 && (
        <div className="py-12 text-center text-gray-500">No listings yet.</div>
      )}
    </div>
  );
}
