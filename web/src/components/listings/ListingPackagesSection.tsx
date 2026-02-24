'use client';

import { ListingPackages } from './ListingPackages';

/** Renders subscription packages with a short intro for My Listings (Featured/Highlighted upgrade context). */
export function ListingPackagesSection() {
  return (
    <section className="mb-8">
      <p className="mb-4 text-sm text-gray-600">
        Upgrade your plan to get more listings and assign <strong>Featured</strong> (home carousel) and <strong>Highlighted</strong> (search) spots to your listings.
      </p>
      <ListingPackages />
    </section>
  );
}
