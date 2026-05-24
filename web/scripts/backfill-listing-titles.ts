/**
 * Regenerate all listing titles using suburb → city → state location order.
 *
 * Usage:
 *   npx tsx scripts/backfill-listing-titles.ts          # dry-run
 *   npx tsx scripts/backfill-listing-titles.ts --apply  # persist
 */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { buildCanonicalListingTitle } from '../src/lib/listing-title';
import { ensureUniqueListingSlug } from '../src/lib/listing-slug';

function parseArgs() {
  const argv = process.argv.slice(2);
  return { apply: argv.includes('--apply') };
}

type ListingRow = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  listingType?: string;
  propertyType?: string;
  propertyTypes?: string[];
  bedrooms?: number;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    suburb?: string;
  };
  slug?: string;
};

function titleInputFromRow(row: ListingRow) {
  const loc = row.location ?? {};
  return {
    listingType: String(row.listingType ?? 'sale'),
    propertyType: String(row.propertyType ?? 'apartment'),
    propertyTypes: Array.isArray(row.propertyTypes) ? row.propertyTypes.map(String) : undefined,
    address: typeof loc.address === 'string' ? loc.address : undefined,
    city: typeof loc.city === 'string' ? loc.city : undefined,
    state: typeof loc.state === 'string' ? loc.state : undefined,
    suburb: typeof loc.suburb === 'string' ? loc.suburb : undefined,
    bedrooms: typeof row.bedrooms === 'number' ? row.bedrooms : 0,
  };
}

async function main() {
  const { apply } = parseArgs();

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing (set in .env.local)');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const rows = (await Listing.find({})
    .select('_id title listingType propertyType propertyTypes bedrooms location slug')
    .lean()
    .exec()) as ListingRow[];

  let scanned = 0;
  let changed = 0;
  let slugUpdated = 0;
  const samples: Array<{ id: string; before: string; after: string }> = [];

  for (const row of rows) {
    scanned++;
    const before = String(row.title ?? '').trim();
    const after = buildCanonicalListingTitle(titleInputFromRow(row));
    if (before === after) continue;

    changed++;
    if (samples.length < 15) {
      samples.push({ id: String(row._id), before, after });
    }

    if (!apply) continue;

    const slug = await ensureUniqueListingSlug({
      title: after,
      location: row.location,
      excludeId: String(row._id),
    });
    const slugChanged = String(row.slug ?? '') !== slug;
    if (slugChanged) slugUpdated++;

    await Listing.updateOne(
      { _id: row._id },
      { $set: { title: after, slug } }
    );
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        changed,
        slugUpdated: apply ? slugUpdated : undefined,
        apply,
        samples,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
