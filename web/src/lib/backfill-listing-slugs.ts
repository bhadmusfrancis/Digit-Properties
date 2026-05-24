import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { ensureUniqueListingSlug } from '@/lib/listing-slug';

export type BackfillListingSlugsResult = {
  updated: number;
  samples: { id: string; slug: string }[];
};

/** Assign SEO slugs to listings that do not have one yet. */
export async function backfillListingSlugs(options?: {
  sampleLimit?: number;
}): Promise<BackfillListingSlugsResult> {
  await dbConnect();
  const listings = await Listing.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
  })
    .select('_id title location slug')
    .lean();

  const samples: { id: string; slug: string }[] = [];
  let updated = 0;

  for (const row of listings) {
    const slug = await ensureUniqueListingSlug({
      title: row.title,
      location: row.location,
      excludeId: String(row._id),
    });
    await Listing.updateOne({ _id: row._id }, { $set: { slug } });
    updated += 1;
    if (samples.length < (options?.sampleLimit ?? 20)) {
      samples.push({ id: String(row._id), slug });
    }
  }

  return { updated, samples };
}
