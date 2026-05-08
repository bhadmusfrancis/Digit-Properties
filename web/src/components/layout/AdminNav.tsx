'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const links = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/verification', label: 'Verification' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/claims', label: 'Claims' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/config', label: 'Subscription config' },
  { href: '/admin/ads', label: 'Ads' },
  { href: '/admin/coupons', label: 'Coupons' },
  { href: '/admin/emails', label: 'Email templates' },
  { href: '/admin/trends', label: 'Trends' },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="mb-6 sm:mb-8">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-700 sm:hidden"
        aria-expanded={open}
        aria-label="Toggle admin menu"
      >
        <span>Admin menu</span>
        <svg
          className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`gap-1 overflow-x-auto pb-2 sm:flex sm:flex-wrap sm:gap-2 sm:overflow-visible sm:pb-0 ${open ? 'mt-2 flex flex-col sm:flex-row' : 'hidden sm:flex'}`}
      >
        {links.map(({ href, label }) => {
          const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`min-h-11 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition-colors sm:min-h-0 sm:px-2 sm:py-1.5 ${
                isActive
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-primary-600'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
