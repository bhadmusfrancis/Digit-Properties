'use client';

import type { ListingSortKey } from '@/lib/sort-listing-rows';

type Props = {
  sortKey: ListingSortKey;
  sortAsc: boolean;
  applySort: (key: Exclude<ListingSortKey, 'default'>) => void;
  resetSort: () => void;
  /** Optional class for the wrapper (e.g. spacing). */
  className?: string;
};

/** Sort controls for screens where table column headers are hidden. */
export function ListingSortMobileBar({ sortKey, sortAsc, applySort, resetSort, className = '' }: Props) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50/90 p-3 sm:hidden ${className}`}
      role="region"
      aria-label="Sort listings"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="listing-sort-field" className="text-xs font-medium text-gray-600">
          Sort by
        </label>
        <select
          id="listing-sort-field"
          value={sortKey}
          onChange={(e) => {
            const v = e.target.value as ListingSortKey;
            if (v === 'default') resetSort();
            else applySort(v);
          }}
          className="input min-w-0 flex-1 text-sm py-2"
        >
          <option value="default">Default order</option>
          <option value="image">Image (with photo first)</option>
          <option value="title">Title</option>
          <option value="price">Price</option>
          <option value="status">Status</option>
          <option value="date">Date</option>
        </select>
      </div>
      {sortKey !== 'default' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applySort(sortKey as Exclude<ListingSortKey, 'default'>)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            {sortAsc ? 'Ascending ↑' : 'Descending ↓'} — tap to reverse
          </button>
          <button type="button" onClick={resetSort} className="text-sm font-medium text-primary-600 hover:underline">
            Reset order
          </button>
        </div>
      )}
    </div>
  );
}
