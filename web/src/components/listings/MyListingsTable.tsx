'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { formatPrice } from '@/lib/utils';
import {
  type ListingSortKey,
  cycleListingSort,
} from '@/lib/sort-listing-rows';
import { buildListingListQuery } from '@/lib/listing-list-query';
import { MyListingActions } from './MyListingActions';
import { SortColumnHeader } from './SortColumnHeader';
import { getListingDisplayImage, isDefaultListingImageUrl } from '@/lib/listing-default-image';

type ListingRow = {
  _id: string;
  title: string;
  price: number;
  status: string;
  listingType: string;
  propertyType: string;
  rentPeriod?: string;
  createdAt?: string;
  images?: { url?: string; public_id?: string }[];
  videos?: { url?: string; public_id?: string }[];
  featured?: boolean;
  highlighted?: boolean;
  soldAt?: string;
  rentedAt?: string;
};

export function MyListingsTable({
  listings,
  sortKey,
  sortAsc,
  basePath,
}: {
  listings: ListingRow[];
  sortKey: ListingSortKey;
  sortAsc: boolean;
  basePath: string;
}) {
  const router = useRouter();

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

  const thumb = (l: ListingRow) => {
    const url = getListingDisplayImage(l.images, l.propertyType, l.videos);
    if (url && !isDefaultListingImageUrl(url)) {
      return <img src={url} alt="" className="h-12 w-16 rounded object-cover bg-gray-100" />;
    }
    return <div className="h-12 w-16 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">No img</div>;
  };

  // Must be deterministic between server-render and browser hydration.
  // Use UTC date only (YYYY-MM-DD) to avoid timezone/locale mismatches.
  const formatCreatedAt = (createdAt?: string) => {
    if (!createdAt) return '—';
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow">
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
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className={`inline-flex rounded-full px-2 py-0.5 ${
                    l.status === 'active' ? 'bg-green-100 text-green-800' : l.status === 'draft' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {l.status}
                  </span>
                  <span>{formatCreatedAt(l.createdAt)}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 ${l.featured ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                    {l.featured ? 'Featured' : 'Standard'}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 ${l.highlighted ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-600'}`}>
                    {l.highlighted ? 'Highlighted' : 'Normal'}
                  </span>
                  {(l.soldAt || l.rentedAt) && (
                    <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${l.soldAt ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {l.soldAt ? 'Sold' : 'Rented'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <MyListingActions
                listingId={l._id}
                listingType={l.listingType}
                soldAt={l.soldAt}
                rentedAt={l.rentedAt}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden sm:block">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-100 bg-gray-50/80 px-2 py-2 sm:px-3">
        <span className="mr-auto text-xs text-gray-500">Sort by column headers</span>
        {sortKey !== 'default' && (
          <button type="button" onClick={resetSort} className="text-xs font-medium text-primary-600 hover:underline">
            Reset order
          </button>
        )}
      </div>
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
              className="px-2 py-3 sm:px-4"
              label="Date"
              active={sortKey === 'date'}
              ascending={sortAsc}
              onClick={() => applySort('date')}
            />
            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Package visibility</th>
            <th className="px-2 py-3 text-right text-xs font-medium uppercase text-gray-500 sm:px-4">Quick actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {listings.map((l) => {
            return (
            <tr
              key={l._id}
              onClick={() => router.push(`/listings/${l._id}`)}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                {thumb(l)}
              </td>
              <td className="px-2 py-3 sm:px-4 text-sm font-medium text-gray-900 max-w-[120px] sm:max-w-none truncate sm:whitespace-normal" title={l.title}>{l.title}</td>
              <td className="px-2 py-3 text-sm text-gray-600 sm:px-4">
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
              <td className="px-4 py-3 text-sm text-gray-600" onClick={(e) => e.stopPropagation()}>
                {formatCreatedAt(l.createdAt)}
              </td>
              <td className="hidden md:table-cell px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap items-center gap-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${l.featured ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                    {l.featured ? 'Featured' : 'Standard'}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${l.highlighted ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-600'}`}>
                    {l.highlighted ? 'Highlighted' : 'Normal search'}
                  </span>
                </div>
              </td>
              <td className="px-2 py-3 text-right sm:px-4" onClick={(e) => e.stopPropagation()}>
                <MyListingActions
                  listingId={l._id}
                  listingType={l.listingType}
                  soldAt={l.soldAt}
                  rentedAt={l.rentedAt}
                />
              </td>
            </tr>
          );
          })}
        </tbody>
      </table>
      {listings.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No listings yet.{' '}
          <Link href="/listings/new" className="text-primary-600 hover:underline" onClick={(e) => e.stopPropagation()}>
            Create one
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}
