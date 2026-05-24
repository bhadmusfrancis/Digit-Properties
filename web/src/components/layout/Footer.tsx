import Link from 'next/link';
import { buildLocationLandingPath } from '@/lib/location-seo';
import { LISTING_TYPE } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
              DP
            </div>
            <p className="mt-4 text-sm">
              Nigeria premier real estate platform. Buy, sell, and rent properties with confidence.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Popular Locations</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href={buildLocationLandingPath('Lagos')} className="hover:text-white">
                  Lagos
                </Link>
              </li>
              <li>
                <Link href={buildLocationLandingPath('FCT')} className="hover:text-white">
                  Abuja
                </Link>
              </li>
              <li>
                <Link href={buildLocationLandingPath('Rivers', { city: 'Port Harcourt' })} className="hover:text-white">
                  Port Harcourt
                </Link>
              </li>
              <li>
                <Link href={buildLocationLandingPath('Ogun')} className="hover:text-white">
                  Ogun
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white">Buy and Rent</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/listings" className="hover:text-white">
                  Browse Listings
                </Link>
              </li>
              <li>
                <Link href={buildLocationLandingPath('Lagos', { listingType: LISTING_TYPE.SALE })} className="hover:text-white">
                  For Sale
                </Link>
              </li>
              <li>
                <Link href={buildLocationLandingPath('Lagos', { listingType: LISTING_TYPE.RENT })} className="hover:text-white">
                  For Rent
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/trends" className="hover:text-white">
                  Trends
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
          <Link href="/terms" className="hover:text-gray-300">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-gray-300">Privacy Policy</Link>
          <span>
            © {new Date().getFullYear()} Digit Properties · A brand of{' '}
            <span className="font-semibold text-gray-200">
              FABHA International
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}

