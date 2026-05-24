import Link from 'next/link';
import {
  FEATURED_PROPERTY_MARKETS,
  buildLocationLandingPath,
} from '@/lib/location-seo';
import { LISTING_TYPE } from '@/lib/constants';

export function LocationHighlights() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 border-t border-gray-200 bg-gray-50">
      <h2 className="text-2xl font-bold text-gray-900">Browse by Location</h2>
      <p className="mt-1 text-sm text-gray-500">
        Explore verified property listings in Nigeria&apos;s top markets.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURED_PROPERTY_MARKETS.map((market) => {
          const href = market.city
            ? buildLocationLandingPath(market.state, { city: market.city })
            : buildLocationLandingPath(market.state);
          const saleHref = buildLocationLandingPath(market.state, {
            city: market.city,
            listingType: LISTING_TYPE.SALE,
          });
          const rentHref = buildLocationLandingPath(market.state, {
            city: market.city,
            listingType: LISTING_TYPE.RENT,
          });
          return (
            <div
              key={`${market.state}-${market.city ?? 'all'}`}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <Link href={href} className="block font-semibold text-gray-900 hover:text-primary-700">
                {market.label}
              </Link>
              <p className="mt-1 text-sm text-gray-600">Properties for sale and rent</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link href={saleHref} className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-700 hover:bg-primary-100">
                  For sale
                </Link>
                <Link href={rentHref} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 hover:bg-gray-200">
                  For rent
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
