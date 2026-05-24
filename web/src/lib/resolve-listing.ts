import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { ensureUniqueListingSlug } from '@/lib/listing-slug';
import { getListingPathSegment } from '@/lib/listing-path';
import Listing, { type IListing } from '@/models/Listing';

type ListingLean = IListing & { _id: mongoose.Types.ObjectId; slug?: string };

export async function findListingByPublicParam(param: string): Promise<ListingLean | null> {
  await dbConnect();
  const trimmed = param.trim();
  if (!trimmed) return null;

  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    const byId = await Listing.findById(trimmed).lean();
    if (byId) return byId as ListingLean;
  }

  const bySlug = await Listing.findOne({ slug: trimmed }).lean();
  return bySlug ? (bySlug as ListingLean) : null;
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
  listing: ListingLean;
  publicSegment: string;
  shouldRedirect: boolean;
}> {
  const listing = await findListingByPublicParam(param);
  if (!listing) {
    throw new Error('NOT_FOUND');
  }
  const publicSegment = await ensureListingSlugOnRecord(listing);
  return {
    listing,
    publicSegment,
    shouldRedirect: param.trim() !== publicSegment,
  };
}

export function listingPublicPathFromRecord(listing: { _id: mongoose.Types.ObjectId; slug?: string }): string {
  return `/listings/${getListingPathSegment(listing)}`;
}
