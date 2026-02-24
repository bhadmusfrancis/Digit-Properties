'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export type PackageDisplay = {
  tier: string;
  label: string;
  priceMonthly: number;
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  maxFeatured: number;
  maxHighlighted: number;
  isGuestOrFree: boolean;
};

function formatPrice(n: number): string {
  if (n === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export function ListingPackages() {
  const [packages, setPackages] = useState<PackageDisplay[]>([]);
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/packages').then((r) => r.json()),
      fetch('/api/me').then((r) => (r.ok ? r.json() : { subscriptionTier: null })).catch(() => ({ subscriptionTier: null })),
    ]).then(([pkgList, me]) => {
      if (Array.isArray(pkgList)) setPackages(pkgList);
      setCurrentTier(me?.subscriptionTier ?? 'free');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || packages.length === 0) {
    return (
      <div className="mb-10 rounded-2xl border border-gray-200/80 bg-white p-8 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  const isCurrentTier = (tier: string) => {
    if (!currentTier) return false;
    if (tier === 'guest' && (currentTier === 'guest' || currentTier === 'free')) return true;
    return currentTier === tier;
  };

  return (
    <section className="mb-10" aria-labelledby="packages-heading">
      <div className="text-center">
        <h2 id="packages-heading" className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Choose your listing plan
        </h2>
        <p className="mt-2 text-base text-gray-600 max-w-xl mx-auto">
          Guests use the free plan by default. Upgrade for more listings, media, and visibility with Featured & Highlighted spots.
        </p>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {packages.map((pkg, index) => {
          const isCurrent = isCurrentTier(pkg.tier);
          const isGold = pkg.tier === 'gold';
          const isPremium = pkg.tier === 'premium';
          const isPopular = isGold;
          const isBestValue = isPremium;

          return (
            <div
              key={pkg.tier}
              className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 shadow-lg transition-all duration-200 hover:shadow-xl sm:p-7 ${
                isCurrent
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : isPopular
                    ? 'border-amber-400 border-2'
                    : 'border-gray-200/80 hover:border-gray-300'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-semibold text-white shadow">
                  Most popular
                </div>
              )}
              {isBestValue && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-600 px-3 py-0.5 text-xs font-semibold text-white shadow">
                  Best value
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-semibold text-white shadow">
                  Your plan
                </div>
              )}

              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">{pkg.label}</h3>
                <p className="mt-2">
                  <span className="text-3xl font-extrabold tracking-tight text-gray-900">
                    {formatPrice(pkg.priceMonthly)}
                  </span>
                  {pkg.priceMonthly > 0 && (
                    <span className="text-sm font-medium text-gray-500">/month</span>
                  )}
                </p>
              </div>

              <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600 shrink-0" aria-hidden>✓</span>
                  <span><strong>{pkg.maxListings}</strong> listings per month</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600 shrink-0" aria-hidden>✓</span>
                  <span><strong>{pkg.maxImages}</strong> images per listing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600 shrink-0" aria-hidden>✓</span>
                  <span><strong>{pkg.maxVideos}</strong> video{pkg.maxVideos !== 1 ? 's' : ''} per listing</span>
                </li>
                {pkg.maxFeatured > 0 || pkg.maxHighlighted > 0 ? (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-600 shrink-0" aria-hidden>★</span>
                      <span><strong>{pkg.maxFeatured}</strong> Featured listings (home carousel)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-600 shrink-0" aria-hidden>★</span>
                      <span><strong>{pkg.maxHighlighted}</strong> Highlighted listings (search)</span>
                    </li>
                  </>
                ) : (
                  <li className="flex items-start gap-2 text-gray-500">
                    <span className="shrink-0" aria-hidden>—</span>
                    <span>No Featured or Highlighted</span>
                  </li>
                )}
              </ul>

              {!isCurrent && pkg.priceMonthly > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Link
                    href={`/dashboard/payments/upgrade?tier=${pkg.tier}`}
                    className="block w-full rounded-xl bg-gray-900 py-2.5 text-center text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                  >
                    Upgrade to {pkg.label}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
