import Link from 'next/link';
import { FEATURED_PROPERTY_MARKETS, buildLocationLandingPath } from '@/lib/location-seo';
import { LISTING_TYPE } from '@/lib/constants';

export function PropertyLocationLinks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 border-t border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">Find properties by location</h2>
      <p className="mt-1 text-sm text-gray-500">Browse listings in major Nigerian markets.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {FEATURED_PROPERTY_MARKETS.map((market) => (
          <Link
            key={`${market.state}-${market.city ?? 'all'}`}
            href={
              market.city
                ? buildLocationLandingPath(market.state, { city: market.city })
                : buildLocationLandingPath(market.state)
            }
            className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700 hover:bg-primary-100"
          >
            {market.label}
          </Link>
        ))}
        <Link
          href={buildLocationLandingPath('Lagos', { listingType: LISTING_TYPE.RENT })}
          className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
        >
          Lagos rentals
        </Link>
        <Link
          href={buildLocationLandingPath('FCT', { listingType: LISTING_TYPE.SALE })}
          className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
        >
          Abuja for sale
        </Link>
      </div>
    </section>
  );
}
