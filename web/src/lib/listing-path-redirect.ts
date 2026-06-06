import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { buildLocationLandingPath } from '@/lib/location-seo';
import type { ILocation } from '@/models/Listing';
import ListingPathRedirect from '@/models/ListingPathRedirect';

/** Best-effort browse destination after a listing is removed. */
export function buildListingDeleteRedirectDestination(location?: Partial<ILocation> | null): string {
  const state = location?.state?.trim();
  if (!state) return '/listings';
  const suburb = location?.suburb?.trim();
  const city = location?.city?.trim();
  if (suburb) return buildLocationLandingPath(state, { suburb });
  if (city) return buildLocationLandingPath(state, { city });
  return buildLocationLandingPath(state);
}

export function collectListingPathSegments(listing: {
  _id: mongoose.Types.ObjectId | string;
  slug?: string | null;
  previousSlugs?: string[] | null;
}): string[] {
  const segments = new Set<string>();
  const id = String(listing._id).trim();
  if (id) segments.add(id);
  const slug = typeof listing.slug === 'string' ? listing.slug.trim() : '';
  if (slug) segments.add(slug);
  for (const prev of listing.previousSlugs ?? []) {
    const p = String(prev).trim();
    if (p) segments.add(p);
  }
  return [...segments];
}

/** Persist tombstone redirects before hard-deleting a listing document. */
export async function recordListingPathRedirects(listing: {
  _id: mongoose.Types.ObjectId | string;
  slug?: string | null;
  previousSlugs?: string[] | null;
  location?: Partial<ILocation> | null;
}): Promise<void> {
  await dbConnect();
  const destinationPath = buildListingDeleteRedirectDestination(listing.location);
  const segments = collectListingPathSegments(listing);
  if (!segments.length) return;

  const listingId = new mongoose.Types.ObjectId(String(listing._id));
  await ListingPathRedirect.bulkWrite(
    segments.map((pathSegment) => ({
      updateOne: {
        filter: { pathSegment },
        update: { $set: { destinationPath, listingId } },
        upsert: true,
      },
    }))
  );
}

export async function findDeletedListingPathRedirect(param: string): Promise<string | null> {
  await dbConnect();
  const trimmed = param.trim();
  if (!trimmed) return null;
  const doc = await ListingPathRedirect.findOne({ pathSegment: trimmed }).select('destinationPath').lean();
  const path = doc?.destinationPath;
  return typeof path === 'string' && path.startsWith('/') ? path : null;
}
