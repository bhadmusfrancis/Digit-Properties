'use client';

import Link from 'next/link';

/** Renders a catchy upgrade CTA at the top of My Properties. */
export function ListingPackagesSection() {
  return (
    <section className="mt-6 rounded-2xl border-2 border-primary-200 bg-gradient-to-r from-primary-50 to-amber-50/80 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Get more eyes on your properties
          </h2>
          <p className="mt-2 max-w-xl text-gray-700">
            Stand out with <strong className="text-amber-700">Featured</strong> spots on the homepage and <strong className="text-sky-700">Highlighted</strong> listings in search. Upgrade once, get more leads.
          </p>
        </div>
        <Link
          href="/dashboard/payments/plans"
          className="shrink-0 rounded-xl bg-primary-600 px-6 py-3 text-center font-semibold text-white shadow-md transition hover:bg-primary-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Upgrade now →
        </Link>
      </div>
    </section>
  );
}
