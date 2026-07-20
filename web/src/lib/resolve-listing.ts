import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { ensureUniqueListingSlug } from '@/lib/listing-slug';
import { getListingPathSegment } from '@/lib/listing-path';
import Listing, { type IListing } from '@/models/Listing';

type ListingLean = IListing & { _id: mongoose.Types.ObjectId; slug?: string };

export type FindListingByPublicParamResult =
  | { type: 'listing'; listing: ListingLean }
  | { type: 'gone' };

export async function findListingByPublicParam(param: string): Promise<FindListingByPublicParamResult> {
  await dbConnect();
  const trimmed = param.trim();
  if (!trimmed) return { type: 'gone' };

  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    const byId = await Listing.findById(trimmed).lean();
    if (byId) return { type: 'listing', listing: byId as ListingLean };
  }

  const bySlug = await Listing.findOne({ slug: trimmed }).lean();
  if (bySlug) return { type: 'listing', listing: bySlug as ListingLean };

  const byPreviousSlug = await Listing.findOne({ previousSlugs: trimmed }).lean();
  if (byPreviousSlug) return { type: 'listing', listing: byPreviousSlug as ListingLean };

  // Deleted / unknown segments: 404 (not soft-redirect to /listings or location pages).
  // Soft redirects inflated GSC "Page with redirect" and wasted crawl budget.
  return { type: 'gone' };
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
  gone?: boolean;
}> {
  const found = await findListingByPublicParam(param);
  if (found.type === 'gone') {
    return { shouldRedirect: false, gone: true };
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
