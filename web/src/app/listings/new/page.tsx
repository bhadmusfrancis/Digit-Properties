'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { NewListingWizard } from '@/components/listings/NewListingWizard';

export default function NewListingPage() {
  const { data: session, status } = useSession();

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => fetch('/api/dashboard/stats').then((r) => r.json()),
    enabled: !!session,
  });

  const listingsCount = typeof stats?.listingsCount === 'number' ? stats.listingsCount : 0;
  const maxListings = typeof stats?.maxListings === 'number' ? stats.maxListings : 99999;
  const isOneAwayFromLimit = maxListings < 100 && listingsCount === maxListings - 1;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50/30">
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="h-10 w-56 animate-pulse rounded-xl bg-sky-100/60" />
          <div className="mt-8 h-96 animate-pulse rounded-2xl bg-white/80 shadow-sm" />
        </div>
      </div>
    );
  }

  if (!session) {
    redirect('/auth/signin?callbackUrl=/listings/new');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50/40">
      {/* Header */}
      <header className="border-b border-sky-100/80 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/listings"
            className="text-sm font-medium text-sky-700 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 rounded-lg px-2 py-1 -ml-2"
          >
            ← Back to listings
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {isOneAwayFromLimit && (
          <div
            role="alert"
            className="mb-6 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/60 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600" aria-hidden>
                ✓
              </span>
              <div>
                <p className="font-medium text-gray-900">
                  You&apos;re one listing away from your current limit ({listingsCount} of {maxListings}).
                </p>
                <p className="mt-0.5 text-sm text-gray-700">
                  Verify your account to enjoy <strong>unlimited listings</strong> and get more visibility with buyers and tenants.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/profile"
              className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Verify account
            </Link>
          </div>
        )}

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            List a property in three easy steps
          </h1>
          <p className="mt-2 text-base text-gray-600 max-w-xl mx-auto">
            A guided flow for details, location, then title, description, and photos.
            Required fields are marked with <span className="text-red-500">*</span>.
          </p>
        </div>

        <NewListingWizard />

        <p className="mt-8 text-center text-sm text-gray-500">
          You can save as a draft or publish when you&apos;re ready—progress is saved only after you submit on step 3.
        </p>
      </main>
    </div>
  );
}
