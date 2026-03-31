'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

function PageControl({
  href,
  disabled,
  children,
  'aria-label': ariaLabel,
}: {
  href: string;
  disabled: boolean;
  children: ReactNode;
  'aria-label': string;
}) {
  const className =
    'min-h-11 min-w-11 sm:min-w-[5.5rem] inline-flex flex-1 shrink-0 sm:flex-none items-center justify-center rounded-lg border px-2 sm:px-3 text-sm font-medium touch-manipulation transition-colors';
  if (disabled) {
    return (
      <span
        className={`${className} cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400`}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${className} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}

export function CompactPagination({
  page,
  totalPages,
  previousHref,
  nextHref,
  className = '',
}: {
  page: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className={`mx-auto flex w-full max-w-lg items-center justify-center gap-2 ${className}`}
      aria-label="Pagination"
    >
      <PageControl href={previousHref} disabled={page <= 1} aria-label="Previous page">
        <span className="text-lg leading-none sm:hidden" aria-hidden>
          ‹
        </span>
        <span className="hidden sm:inline">Previous</span>
      </PageControl>
      <span className="min-w-[4.5rem] shrink-0 px-1 text-center text-sm tabular-nums text-gray-600 sm:min-w-[6.5rem] sm:px-2">
        <span className="hidden sm:inline">Page </span>
        {page} / {totalPages}
      </span>
      <PageControl href={nextHref} disabled={page >= totalPages} aria-label="Next page">
        <span className="text-lg leading-none sm:hidden" aria-hidden>
          ›
        </span>
        <span className="hidden sm:inline">Next</span>
      </PageControl>
    </nav>
  );
}
