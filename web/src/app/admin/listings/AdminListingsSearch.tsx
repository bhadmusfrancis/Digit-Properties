'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildListingListQuery, parseListingSortFromSearchParams } from '@/lib/listing-list-query';

export function AdminListingsSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  function navigate(nextQuery: string) {
    const sp = Object.fromEntries(searchParams.entries());
    const { sortKey, sortAsc } = parseListingSortFromSearchParams(sp);
    router.push(`/admin/listings${buildListingListQuery(1, sortKey, sortAsc, nextQuery)}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(query);
  }

  function clearSearch() {
    setQuery('');
    navigate('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
      role="search"
      aria-label="Search listings"
    >
      <div className="relative min-w-0 flex-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by listing title, contact name, phone, address, owner, status, or listing ID…"
          className="input w-full pl-9"
          maxLength={200}
        />
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="submit" className="btn-primary min-h-[44px] flex-1 touch-manipulation sm:flex-none">
          Search
        </button>
        {initialQuery ? (
          <button
            type="button"
            onClick={clearSearch}
            className="btn-secondary min-h-[44px] flex-1 touch-manipulation sm:flex-none"
          >
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}
