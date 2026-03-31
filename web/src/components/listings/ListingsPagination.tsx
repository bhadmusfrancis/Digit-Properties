'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Pagination = { page: number; pages: number; total?: number };

/** Build query string preserving filters; page omitted when 1 for cleaner URLs. */
function listingsQueryForPage(
  searchParams: { forEach: (fn: (value: string, key: string) => void) => void },
  page: number
): string {
  const q = new URLSearchParams();
  searchParams.forEach((v, k) => {
    if (!v || k === 'page') return;
    q.set(k, v);
  });
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** e.g. [1, 'dots', 4, 5, 6, 'dots', 20] */
function pageNumberItems(currentPage: number, totalPages: number): (number | 'dots')[] {
  if (totalPages <= 1) return [];
  const delta = 1;
  const range: number[] = [];
  const withDots: (number | 'dots')[] = [];
  let last: number | undefined;

  range.push(1);
  for (let i = currentPage - delta; i <= currentPage + delta; i++) {
    if (i < totalPages && i > 1) range.push(i);
  }
  range.push(totalPages);

  for (const i of range) {
    if (last != null) {
      if (i - last === 2) withDots.push(last + 1);
      else if (i - last > 1) withDots.push('dots');
    }
    withDots.push(i);
    last = i;
  }
  return withDots;
}

export function ListingsPagination({ pagination }: { pagination: Pagination }) {
  const searchParams = useSearchParams();
  const { page, pages: totalPages, total } = pagination;

  if (totalPages <= 1) return null;

  const href = (p: number) => `/listings${listingsQueryForPage(searchParams, p)}`;
  const prevP = Math.max(1, page - 1);
  const nextP = Math.min(totalPages, page + 1);
  const items = pageNumberItems(page, totalPages);

  const btnBase =
    'min-h-9 min-w-9 inline-flex items-center justify-center rounded-md border text-sm font-medium transition-colors touch-manipulation';
  const inactive = `${btnBase} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`;
  const active = `${btnBase} border-primary-600 bg-primary-600 text-white`;

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <nav
        className="mx-auto flex w-full max-w-lg items-center justify-center gap-2"
        aria-label="Pagination"
      >
        {page <= 1 ? (
          <span
            className={`${btnBase} cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400`}
            aria-disabled="true"
          >
            <span className="text-lg leading-none sm:hidden" aria-hidden>
              ‹
            </span>
            <span className="hidden sm:inline">Previous</span>
          </span>
        ) : (
          <Link href={href(prevP)} className={inactive} aria-label="Previous page">
            <span className="text-lg leading-none sm:hidden" aria-hidden>
              ‹
            </span>
            <span className="hidden sm:inline">Previous</span>
          </Link>
        )}
        <span className="min-w-[4.5rem] shrink-0 px-1 text-center text-sm tabular-nums text-gray-600 sm:min-w-[7rem] sm:px-2">
          <span className="hidden sm:inline">Page </span>
          {page} / {totalPages}
        </span>
        {page >= totalPages ? (
          <span
            className={`${btnBase} cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400`}
            aria-disabled="true"
          >
            <span className="text-lg leading-none sm:hidden" aria-hidden>
              ›
            </span>
            <span className="hidden sm:inline">Next</span>
          </span>
        ) : (
          <Link href={href(nextP)} className={inactive} aria-label="Next page">
            <span className="text-lg leading-none sm:hidden" aria-hidden>
              ›
            </span>
            <span className="hidden sm:inline">Next</span>
          </Link>
        )}
      </nav>

      {totalPages > 2 && (
        <nav
          className="flex max-w-full flex-wrap items-center justify-center gap-1 px-1"
          aria-label="Jump to page"
        >
          {items.map((item, idx) =>
            item === 'dots' ? (
              <span key={`dots-${idx}`} className="px-1 text-sm text-gray-400">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={href(item)}
                className={item === page ? active : inactive}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </Link>
            )
          )}
        </nav>
      )}

      {typeof total === 'number' && total >= 0 && (
        <p className="text-center text-xs text-gray-500">
          {total.toLocaleString()} listing{total === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}
