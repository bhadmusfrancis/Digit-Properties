'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ListingForm } from '@/components/listings/ListingForm';

export default function NewListingPage() {
  const { data: session, status } = useSession();

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
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/listings"
            className="text-sm font-medium text-sky-700 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 rounded-lg px-2 py-1 -ml-2"
          >
            ← Back to listings
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            List a property
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Fill in the details below. Required fields are marked with <span className="text-red-500">*</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg shadow-sky-100/30 sm:p-8">
          <ListingForm />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Your listing can be saved as a draft or published right away.
        </p>
      </main>
    </div>
  );
}
