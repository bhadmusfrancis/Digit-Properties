import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { LISTING_STATUS } from '@/lib/constants';
import { ensureUniqueListingSlug } from '@/lib/listing-slug';

async function main() {
  await dbConnect();
  const listings = await Listing.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
  })
    .select('_id title location slug')
    .lean();

  let updated = 0;
  for (const row of listings) {
    const slug = await ensureUniqueListingSlug({
      title: row.title,
      location: row.location,
      excludeId: String(row._id),
    });
    await Listing.updateOne({ _id: row._id }, { $set: { slug } });
    updated += 1;
    console.log(`${String(row._id)} -> ${slug}`);
  }
  console.log(`Backfilled ${updated} listing slug(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
