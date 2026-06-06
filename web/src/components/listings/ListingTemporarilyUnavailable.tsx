import Link from 'next/link';
import { buildLocationLandingPath } from '@/lib/location-seo';

type Props = {
  title?: string | null;
  state?: string | null;
  city?: string | null;
};

/** Shown when a listing exists but is hidden pending admin approval (not a hard 404). */
export function ListingTemporarilyUnavailable({ title, state, city }: Props) {
  const locationPath =
    state?.trim() ?
      buildLocationLandingPath(state.trim(), city?.trim() ? { city: city.trim() } : undefined)
    : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Temporarily unavailable</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
        {title?.trim() ? title : 'This listing is temporarily unavailable'}
      </h1>
      <p className="mt-4 text-gray-600">
        This property is being reviewed and is not publicly visible right now. Please check back soon or
        browse other listings in the area.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/listings" className="btn-primary">
          Browse all listings
        </Link>
        {locationPath ? (
          <Link href={locationPath} className="btn-secondary">
            View nearby properties
          </Link>
        ) : null}
      </div>
    </div>
  );
}
