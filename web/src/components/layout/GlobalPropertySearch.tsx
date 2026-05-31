'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ListingSearchSortSelect } from '@/components/listings/ListingSearchSortSelect';
import {
  defaultListingSearchSort,
  isListingSearchSortKey,
  type ListingSearchSortKey,
} from '@/lib/listing-search-sort';

export function GlobalPropertySearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onListingsPage = pathname === '/listings' || pathname.startsWith('/listings/');

  const urlQ = onListingsPage ? searchParams.get('q') ?? '' : '';
  const urlSort = onListingsPage ? searchParams.get('sort') : null;
  const [query, setQuery] = useState(urlQ);
  const [sort, setSort] = useState<ListingSearchSortKey>(
    isListingSearchSortKey(urlSort) ? urlSort : defaultListingSearchSort(Boolean(urlQ))
  );

  useEffect(() => {
    setQuery(urlQ);
    setSort(isListingSearchSortKey(urlSort) ? urlSort : defaultListingSearchSort(Boolean(urlQ)));
  }, [urlQ, urlSort]);

  function navigate(nextQ: string, nextSort: ListingSearchSortKey) {
    const params = new URLSearchParams();
    if (onListingsPage) {
      searchParams.forEach((value, key) => {
        if (key === 'page' || key === 'q' || key === 'sort') return;
        if (value) params.set(key, value);
      });
    }
    const trimmed = nextQ.trim();
    if (trimmed) params.set('q', trimmed);
    const effectiveSort = nextSort === 'default' && !trimmed ? 'default' : nextSort;
    if (effectiveSort && effectiveSort !== 'default') params.set('sort', effectiveSort);
    else if (trimmed && effectiveSort === 'default') params.set('sort', 'relevance');
    const qs = params.toString();
    router.push(qs ? `/listings?${qs}` : '/listings');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(query, sort);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full min-w-0 flex-1 items-center gap-1 rounded-full border border-gray-200/80 bg-gray-50/90 px-2 py-1 shadow-sm backdrop-blur-sm transition-colors focus-within:border-primary-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-100 sm:gap-2 sm:px-3 sm:py-1.5"
      role="search"
      aria-label="Search properties"
    >
      <svg
        className="ml-1 h-4 w-4 shrink-0 text-gray-400 sm:ml-0"
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
        placeholder="Search properties, areas, keywords…"
        className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
        autoComplete="off"
        enterKeyHint="search"
      />
      <div className="shrink-0 border-l border-gray-200 pl-1 sm:pl-2">
        <ListingSearchSortSelect value={sort} onChange={setSort} compact />
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 sm:text-sm"
      >
        Search
      </button>
    </form>
  );
}

export function GlobalPropertySearchFallback() {
  return (
    <div
      className="flex w-full min-w-0 flex-1 items-center rounded-full border border-gray-200/80 bg-gray-50/90 px-4 py-2.5"
      aria-hidden
    >
      <div className="h-4 w-full max-w-xs animate-pulse rounded bg-gray-200" />
    </div>
  );
}
