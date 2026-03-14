'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hasGoogleProvider, setHasGoogleProvider] = useState(false);

  useEffect(() => {
    fetch('/api/auth/providers')
      .then((res) => res.json())
      .then((data: Record<string, unknown>) => {
        setHasGoogleProvider(Boolean(data?.google));
      })
      .catch(() => setHasGoogleProvider(false));
  }, []);

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
          <Link href="/listings?listingType=sale" className="text-sm font-medium text-gray-700 hover:text-primary-600">
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
              {hasGoogleProvider && (
                <button
                  type="button"
                  onClick={() => signIn('google', { callbackUrl: pathname || '/' })}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <GoogleIcon />
                  Sign in with Google
                </button>
              )}
              <Link href="/auth/signin" className="btn-secondary text-sm">
                Sign in
              </Link>
              <Link href="/auth/signup" className={hasGoogleProvider ? 'btn-secondary text-sm' : 'btn-primary text-sm'}>
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
          <div className="flex flex-col gap-1">
            <Link href="/listings?listingType=sale" className="min-h-[44px] flex items-center text-gray-700 touch-manipulation" onClick={() => setMobileOpen(false)}>
              Buy
            </Link>
            <Link href="/listings?listingType=rent" className="min-h-[44px] flex items-center text-gray-700 touch-manipulation" onClick={() => setMobileOpen(false)}>
              Rent
            </Link>
            <Link href="/listings/new" className="min-h-[44px] flex items-center text-gray-700 touch-manipulation" onClick={() => setMobileOpen(false)}>
              Sell
            </Link>
            <Link href="/trends" className="min-h-[44px] flex items-center text-gray-700 touch-manipulation" onClick={() => setMobileOpen(false)}>
              Trends
            </Link>
            {session ? (
              <>
                <Link href="/dashboard" className="min-h-[44px] flex items-center text-gray-700 touch-manipulation" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                {session.user?.role === 'admin' && (
                  <Link href="/admin" className="min-h-[44px] flex items-center text-primary-600 font-medium touch-manipulation" onClick={() => setMobileOpen(false)}>
                    Admin
                  </Link>
                )}
                <button onClick={() => signOut()} className="min-h-[44px] w-full flex items-center text-left text-red-600 touch-manipulation">
                  Sign out
                </button>
              </>
            ) : (
              <>
                {hasGoogleProvider && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      signIn('google', { callbackUrl: pathname || '/' });
                    }}
                    className="min-h-[44px] flex w-full items-center gap-2 text-left font-medium text-primary-600 touch-manipulation"
                  >
                    <GoogleIcon />
                    Sign in with Google
                  </button>
                )}
                <Link href="/auth/signin" className="min-h-[44px] flex items-center text-gray-700 touch-manipulation" onClick={() => setMobileOpen(false)}>
                  Sign in
                </Link>
                <Link href="/auth/signup" className="min-h-[44px] flex items-center text-primary-600 font-medium touch-manipulation" onClick={() => setMobileOpen(false)}>
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
