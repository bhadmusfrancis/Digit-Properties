'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const links = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/listings', label: 'My Properties' },
  { href: '/dashboard/saved', label: 'Favorites' },
  { href: '/dashboard/alerts', label: 'Property Alerts' },
  { href: '/dashboard/claims', label: 'My Claims' },
  { href: '/dashboard/payments', label: 'Payments' },
  { href: '/dashboard/ads', label: 'Advertise' },
  { href: '/dashboard/profile', label: 'Profile & Verification' },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mb-4 flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 shadow-sm lg:hidden"
        aria-expanded={open}
        aria-label="Toggle dashboard menu"
      >
        <span>Menu</span>
        <svg
          className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <aside
        className={`w-full shrink-0 lg:w-64 ${open ? 'block' : 'hidden lg:block'}`}
        aria-hidden={!open}
      >
        <nav className="space-y-1 rounded-lg border border-gray-200 bg-white p-3 shadow-sm lg:p-4">
          {links.map(({ href, label }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
