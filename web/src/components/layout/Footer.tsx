import Link from 'next/link';
import { buildLocationLandingPath } from '@/lib/location-seo';
import { LISTING_TYPE, SOCIAL_LINKS } from '@/lib/constants';

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
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Follow us</h3>
              <div className="mt-3 flex items-center gap-3">
                <a
                  href={SOCIAL_LINKS.FACEBOOK}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Digit Properties on Facebook"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-300 transition hover:bg-primary-600 hover:text-white"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.898v-2.89h2.54V9.797c0-2.507 1.492-3.892 3.777-3.892 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                </a>
                <a
                  href={SOCIAL_LINKS.TWITTER}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Digit Properties on X"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-300 transition hover:bg-primary-600 hover:text-white"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
                  </svg>
                </a>
              </div>
            </div>
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

