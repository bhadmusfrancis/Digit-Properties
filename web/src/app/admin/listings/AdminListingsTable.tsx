'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback } from 'react';
import { formatPrice } from '@/lib/utils';
import { type ListingSortKey, cycleListingSort } from '@/lib/sort-listing-rows';
import { buildListingListQuery } from '@/lib/listing-list-query';
import { getListingDisplayImage, isDefaultListingImageUrl } from '@/lib/listing-default-image';
import { SortColumnHeader } from '@/components/listings/SortColumnHeader';
import { ListingSortMobileBar } from '@/components/listings/ListingSortMobileBar';
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
  boostPackage?: string;
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
    <div className="rounded-lg border border-gray-200 bg-white shadow">
      <div className="hidden sm:flex flex-wrap items-center justify-end gap-2 border-b border-gray-100 bg-gray-50/80 px-2 py-2 sm:px-3">
        <span className="mr-auto text-xs text-gray-500">Sort by column headers</span>
        {sortKey !== 'default' && (
          <button type="button" onClick={resetSort} className="text-xs font-medium text-primary-600 hover:underline">
            Reset order
          </button>
        )}
      </div>
      <ListingSortMobileBar
        sortKey={sortKey}
        sortAsc={sortAsc}
        applySort={applySort}
        resetSort={resetSort}
        className="mx-3 mt-3"
      />

      <div className="space-y-3 p-3 sm:hidden">
        {listings.map((l) => (
          <article key={l._id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex gap-3">
              <div className="shrink-0">{thumb(l)}</div>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => router.push(`/listings/${l._id}`)}
                  className="line-clamp-2 text-left text-sm font-semibold text-gray-900 hover:text-primary-600"
                >
                  {l.title}
                </button>
                <p className="mt-1 text-sm font-medium text-primary-600">
                  {formatPrice(l.price, l.listingType === 'rent' ? l.rentPeriod : undefined)}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-gray-500">{l.locationLine || 'No address'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`inline-flex rounded-full px-2 py-0.5 ${
                    l.status === 'active' ? 'bg-green-100 text-green-800' : l.status === 'draft' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {l.status}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{formatCreatedAt(l.createdAt)}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 ${l.featured ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                    {l.featured ? 'Featured' : 'Standard'}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 ${l.highlighted ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-600'}`}>
                    {l.highlighted ? 'Highlighted' : 'Normal'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <AdminListingActions
                listingId={l._id}
                status={l.status}
                createdById={createdById(l)}
                createdByLabel={createdByLabel(l)}
                users={users}
                featured={Boolean(l.featured)}
                highlighted={Boolean(l.highlighted)}
                boostPackage={l.boostPackage}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden sm:block">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortColumnHeader
                className="w-14 sm:w-20 px-2 py-3 sm:px-3"
                label="Image"
                active={sortKey === 'image'}
                ascending={sortAsc}
                onClick={() => applySort('image')}
              />
              <SortColumnHeader
                className="px-2 py-3 sm:px-4"
                label="Title"
                active={sortKey === 'title'}
                ascending={sortAsc}
                onClick={() => applySort('title')}
              />
              <th className="hidden lg:table-cell px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Address</th>
              <SortColumnHeader
                className="px-2 py-3 sm:px-4"
                label="Price"
                active={sortKey === 'price'}
                ascending={sortAsc}
                onClick={() => applySort('price')}
              />
              <SortColumnHeader
                className="px-2 py-3 sm:px-4"
                label="Status"
                active={sortKey === 'status'}
                ascending={sortAsc}
                onClick={() => applySort('status')}
              />
              <SortColumnHeader
                className="hidden md:table-cell px-2 py-3 sm:px-4"
                label="Date"
                active={sortKey === 'date'}
                ascending={sortAsc}
                onClick={() => applySort('date')}
              />
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created by</th>
              <th className="px-2 py-3 text-right text-xs font-medium uppercase text-gray-500 sm:px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {listings.map((l) => (
              <Fragment key={l._id}>
                <tr
                  key={`${l._id}-main`}
                  onClick={() => router.push(`/listings/${l._id}`)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {thumb(l)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate">{l.title}</td>
                  <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-600 truncate" title={l.locationLine || ''}>
                    {l.locationLine || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate">
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
                  <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600" onClick={(e) => e.stopPropagation()}>
                    {formatCreatedAt(l.createdAt)}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600">{createdByLabel(l)}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">Actions below</td>
                </tr>
                <tr key={`${l._id}-actions`} className="bg-gray-50/60">
                  <td colSpan={8} className="px-4 py-3">
                    <div onClick={(e) => e.stopPropagation()}>
                      <AdminListingActions
                        listingId={l._id}
                        status={l.status}
                        createdById={createdById(l)}
                        createdByLabel={createdByLabel(l)}
                        users={users}
                        featured={Boolean(l.featured)}
                        highlighted={Boolean(l.highlighted)}
                        boostPackage={l.boostPackage}
                      />
                    </div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {listings.length === 0 && <div className="py-12 text-center text-gray-500">No listings yet.</div>}
    </div>
  );
}
