import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { findDeletedListingPathRedirect } from '@/lib/listing-path-redirect';
import { ensureUniqueListingSlug } from '@/lib/listing-slug';
import { getListingPathSegment } from '@/lib/listing-path';
import Listing, { type IListing } from '@/models/Listing';

type ListingLean = IListing & { _id: mongoose.Types.ObjectId; slug?: string };

export type FindListingByPublicParamResult =
  | { type: 'listing'; listing: ListingLean }
  | { type: 'redirect'; destinationPath: string };

export async function findListingByPublicParam(param: string): Promise<FindListingByPublicParamResult | null> {
  await dbConnect();
  const trimmed = param.trim();
  if (!trimmed) return null;

  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    const byId = await Listing.findById(trimmed).lean();
    if (byId) return { type: 'listing', listing: byId as ListingLean };
  }

  const bySlug = await Listing.findOne({ slug: trimmed }).lean();
  if (bySlug) return { type: 'listing', listing: bySlug as ListingLean };

  const byPreviousSlug = await Listing.findOne({ previousSlugs: trimmed }).lean();
  if (byPreviousSlug) return { type: 'listing', listing: byPreviousSlug as ListingLean };

  const destinationPath = await findDeletedListingPathRedirect(trimmed);
  if (destinationPath) return { type: 'redirect', destinationPath };

  return null;
}

/** Ensure slug exists on the document (lazy backfill for legacy listings). */
export async function ensureListingSlugOnRecord(
  listing: ListingLean
): Promise<string> {
  const existing = typeof listing.slug === 'string' ? listing.slug.trim() : '';
  if (existing) return existing;

  const slug = await ensureUniqueListingSlug({
    title: listing.title,
    location: listing.location,
    excludeId: String(listing._id),
  });
  await Listing.updateOne({ _id: listing._id }, { $set: { slug } });
  listing.slug = slug;
  return slug;
}

export async function resolveListingPublicSegment(param: string): Promise<{
  listing?: ListingLean;
  publicSegment?: string;
  shouldRedirect: boolean;
  redirectTo?: string;
}> {
  const found = await findListingByPublicParam(param);
  if (!found) {
    throw new Error('NOT_FOUND');
  }
  if (found.type === 'redirect') {
    return { shouldRedirect: true, redirectTo: found.destinationPath };
  }

  const listing = found.listing;
  const publicSegment = await ensureListingSlugOnRecord(listing);
  return {
    listing,
    publicSegment,
    shouldRedirect: param.trim() !== publicSegment,
    redirectTo: param.trim() !== publicSegment ? `/listings/${publicSegment}` : undefined,
  };
}

export function listingPublicPathFromRecord(listing: { _id: mongoose.Types.ObjectId; slug?: string }): string {
  return `/listings/${getListingPathSegment(listing)}`;
}
