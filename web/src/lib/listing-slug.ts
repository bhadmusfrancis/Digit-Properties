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

export async function ensureUniqueListingSlug(
  input: { title: string; location?: { city?: string; state?: string }; excludeId?: string | null },
  model: Model<unknown> = Listing as unknown as Model<unknown>
): Promise<string> {
  const base = buildListingSlugBase(input.title, input.location);
  const excludeId = input.excludeId ?? null;
  return uniqueSlug(base, async (candidate) => {
    const filter: Record<string, unknown> = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    const existing = await model.findOne(filter).select('_id').lean();
    return !existing;
  });
}
