'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

export function Header() {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
            DP
          </div>
          <span className="text-xl font-semibold text-gray-900">Digit Properties</span>
        </Link>

        <div className="hidden md:flex md:items-center md:gap-6">
          <Link href="/listings" className="text-sm font-medium text-gray-700 hover:text-primary-600">
            Buy
          </Link>
          <Link href="/listings?listingType=rent" className="text-sm font-medium text-gray-700 hover:text-primary-600">
            Rent
          </Link>
          <Link href="/listings/new" className="text-sm font-medium text-gray-700 hover:text-primary-600">
            Sell
          </Link>
          <Link href="/trends" className="text-sm font-medium text-gray-700 hover:text-primary-600">
            Trends
          </Link>
          {status === 'loading' ? (
            <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
          ) : session ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100"
              >
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-medium">
                    {session.user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="text-sm font-medium">{session.user?.name}</span>
              </button>
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                    aria-hidden
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/listings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My Properties
                    </Link>
                    <Link
                      href="/dashboard/alerts"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Saved Searches
                    </Link>
                    {session.user?.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="block px-4 py-2 text-sm font-medium text-primary-600 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      onClick={() => signOut()}
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/signin" className="btn-secondary text-sm">
                Sign in
              </Link>
              <Link href="/auth/signup" className="btn-primary text-sm">
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden rounded p-2 hover:bg-gray-100"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            <Link href="/listings" className="py-2 text-gray-700" onClick={() => setMobileOpen(false)}>
              Buy
            </Link>
            <Link href="/listings?listingType=rent" className="py-2 text-gray-700" onClick={() => setMobileOpen(false)}>
              Rent
            </Link>
            <Link href="/listings/new" className="py-2 text-gray-700" onClick={() => setMobileOpen(false)}>
              Sell
            </Link>
            <Link href="/trends" className="py-2 text-gray-700" onClick={() => setMobileOpen(false)}>
              Trends
            </Link>
            {session ? (
              <>
                <Link href="/dashboard" className="py-2 text-gray-700" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <button onClick={() => signOut()} className="py-2 text-left text-red-600">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="py-2 text-gray-700" onClick={() => setMobileOpen(false)}>
                  Sign in
                </Link>
                <Link href="/auth/signup" className="py-2 text-primary-600 font-medium" onClick={() => setMobileOpen(false)}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
