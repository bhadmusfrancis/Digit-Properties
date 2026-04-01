'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

export function Header() {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <nav className="mx-auto flex min-h-[56px] max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-0 sm:h-16 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white text-sm font-bold shadow-md">
            DP
          </div>
          <span className="text-lg font-bold text-gray-900 sm:text-xl">Digit Properties</span>
        </Link>

        <div className="hidden md:flex md:items-center md:gap-2">
          <Link href="/listings?listingType=sale" className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
            Buy
          </Link>
          <Link href="/listings?listingType=rent" className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
            Rent
          </Link>
          <Link href="/listings/new" className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
            Sell/Rent
          </Link>
          <Link href="/trends" className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
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
                    className={`h-8 w-8 rounded-full ${session.user.image === '/avatar-guest.svg' ? 'bg-gray-200 p-1.5 object-contain' : 'object-cover'}`}
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
                      Property Alerts
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
          className="md:hidden flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-700 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700 transition-colors touch-manipulation"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-4 md:hidden shadow-inner">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Menu</p>
          <div className="flex flex-col gap-0.5">
            <Link href="/listings?listingType=sale" className="min-h-[48px] flex items-center rounded-lg px-3 font-semibold text-gray-800 hover:bg-white hover:shadow-sm touch-manipulation" onClick={() => setMobileOpen(false)}>
              Buy
            </Link>
            <Link href="/listings?listingType=rent" className="min-h-[48px] flex items-center rounded-lg px-3 font-semibold text-gray-800 hover:bg-white hover:shadow-sm touch-manipulation" onClick={() => setMobileOpen(false)}>
              Rent
            </Link>
            <Link href="/listings/new" className="min-h-[48px] flex items-center rounded-lg px-3 font-semibold text-gray-800 hover:bg-white hover:shadow-sm touch-manipulation" onClick={() => setMobileOpen(false)}>
              Sell/Rent
            </Link>
            <Link href="/trends" className="min-h-[48px] flex items-center rounded-lg px-3 font-semibold text-gray-800 hover:bg-white hover:shadow-sm touch-manipulation" onClick={() => setMobileOpen(false)}>
              Trends
            </Link>
            <div className="my-2 border-t border-gray-200" />
            {session ? (
              <>
                <Link href="/dashboard" className="min-h-[48px] flex items-center rounded-lg px-3 font-semibold text-gray-800 hover:bg-white hover:shadow-sm touch-manipulation" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                {session.user?.role === 'admin' && (
                  <Link href="/admin" className="min-h-[48px] flex items-center rounded-lg px-3 font-semibold text-primary-700 hover:bg-primary-50 touch-manipulation" onClick={() => setMobileOpen(false)}>
                    Admin
                  </Link>
                )}
                <button onClick={() => signOut()} className="min-h-[48px] w-full flex items-center rounded-lg px-3 text-left font-semibold text-red-600 hover:bg-red-50 touch-manipulation">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="min-h-[48px] flex items-center rounded-lg px-3 font-semibold text-gray-800 hover:bg-white hover:shadow-sm touch-manipulation" onClick={() => setMobileOpen(false)}>
                  Sign in
                </Link>
                <Link href="/auth/signup" className="min-h-[48px] flex items-center rounded-lg px-3 font-semibold text-primary-700 hover:bg-primary-50 touch-manipulation" onClick={() => setMobileOpen(false)}>
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
