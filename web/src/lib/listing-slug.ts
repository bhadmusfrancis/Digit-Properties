import type { Model } from 'mongoose';
import Listing from '@/models/Listing';
import { slugify, uniqueSlug } from '@/lib/slugify';

const MAX_SLUG_LEN = 120;

export function buildListingSlugBase(
  title: string,
  location?: { city?: string; state?: string }
): string {
  const parts = [slugify(title)];
  const city = location?.city?.trim();
  const state = location?.state?.trim();
  if (city) parts.push(slugify(city));
  else if (state) parts.push(slugify(state));
  const joined = parts.filter(Boolean).join('-');
  return joined.slice(0, MAX_SLUG_LEN).replace(/-+$/g, '') || 'listing';
}

/** Mongo filter: slug is taken as a current or historical path segment. */
export function slugConflictFilter(
  candidate: string,
  excludeId?: string | null
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    $or: [{ slug: candidate }, { previousSlugs: candidate }],
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return filter;
}

export async function slugPathIsAvailable(
  candidate: string,
  excludeId?: string | null,
  model: Model<unknown> = Listing as unknown as Model<unknown>
): Promise<boolean> {
  const existing = await model.findOne(slugConflictFilter(candidate, excludeId)).select('_id').lean();
  return !existing;
}

export async function ensureUniqueListingSlug(
  input: { title: string; location?: { city?: string; state?: string }; excludeId?: string | null },
  model: Model<unknown> = Listing as unknown as Model<unknown>
): Promise<string> {
  const base = buildListingSlugBase(input.title, input.location);
  const excludeId = input.excludeId ?? null;
  return uniqueSlug(base, async (candidate) => slugPathIsAvailable(candidate, excludeId, model));
}

/** Merge slug + optional previous-slug history into an existing Mongo update op. */
export function withSlugHistoryUpdate(
  updateOp: Record<string, unknown>,
  currentSlug: string | undefined | null,
  newSlug: string
): void {
  const set = (updateOp.$set ?? {}) as Record<string, unknown>;
  set.slug = newSlug;
  updateOp.$set = set;
  const prev = typeof currentSlug === 'string' ? currentSlug.trim() : '';
  if (prev && prev !== newSlug) {
    updateOp.$addToSet = { previousSlugs: prev };
  }
}

/** Persist a slug change and retain the prior slug for 301 redirects. */
export async function persistListingSlugChange(
  listingId: string,
  currentSlug: string | undefined | null,
  newSlug: string,
  model: Model<unknown> = Listing as unknown as Model<unknown>
): Promise<void> {
  const updateOp: Record<string, unknown> = { $set: {} };
  withSlugHistoryUpdate(updateOp, currentSlug, newSlug);
  await model.updateOne({ _id: listingId }, updateOp);
}
