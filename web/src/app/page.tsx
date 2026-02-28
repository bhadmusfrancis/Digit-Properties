import Link from 'next/link';
import { FeaturedListings } from '@/components/listings/FeaturedListings';
import { TrendingListings } from '@/components/listings/TrendingListings';
import { TrendHighlights } from '@/components/trends/TrendHighlights';

export default function HomePage() {

  return (
    <div>
      <section className="relative bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Find Your Dream Property in Nigeria
          </h1>
          <p className="mt-6 max-w-2xl text-xl text-primary-100">
            Browse thousands of apartments, houses, land, and commercial properties for sale and rent across Lagos, Abuja, Port Harcourt, and beyond.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/listings?listingType=sale" className="btn bg-white text-primary-700 hover:bg-primary-50">
              Buy Property
            </Link>
            <Link href="/listings?listingType=rent" className="btn border-2 border-white text-white hover:bg-white/10">
              Rent Property
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Featured Properties</h2>
          <Link href="/listings?featured=1" className="text-primary-600 font-medium hover:underline">
            View all →
          </Link>
        </div>
        <FeaturedListings />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Trending Properties</h2>
          <Link href="/listings" className="text-primary-600 font-medium hover:underline">
            View all →
          </Link>
        </div>
        <p className="text-sm text-gray-500">Top 20 by views — ordered by your area when location is available.</p>
        <TrendingListings />
      </section>

      <TrendHighlights />

      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900">How It Works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600 font-bold">
                1
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Search</h3>
              <p className="mt-2 text-gray-600">
                Filter by location, price, bedrooms, and property type to find the perfect match.
              </p>
            </div>
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600 font-bold">
                2
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Connect</h3>
              <p className="mt-2 text-gray-600">
                Sign in to view contact details and reach out via WhatsApp or phone.
              </p>
            </div>
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600 font-bold">
                3
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Close</h3>
              <p className="mt-2 text-gray-600">
                Work with agents or owners to view properties and close the deal.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
