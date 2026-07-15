/**
 * Set listing price (and optional area) by slug.
 *
 *   npx tsx scripts/set-listing-price-by-slug.ts <slug> <price> [--area <sqm>] [--dry-run]
 */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';

function parseArgs() {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--area');
  const slug = positional[0] ?? '';
  const priceRaw = positional[1] ?? '';
  const dryRun = argv.includes('--dry-run');
  const areaIdx = argv.indexOf('--area');
  const areaRaw =
    areaIdx >= 0 && argv[areaIdx + 1] && !argv[areaIdx + 1].startsWith('--')
      ? argv[areaIdx + 1]
      : undefined;
  return {
    slug,
    price: Number(priceRaw),
    area: areaRaw != null ? Number(areaRaw) : undefined,
    dryRun,
  };
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const { slug, price, area, dryRun } = parseArgs();
  if (!slug || !Number.isFinite(price) || price <= 0) {
    console.error(
      'Usage: npx tsx scripts/set-listing-price-by-slug.ts <slug> <price> [--area <sqm>] [--dry-run]'
    );
    process.exit(1);
  }
  if (area != null && (!Number.isFinite(area) || area <= 0)) {
    console.error('--area must be a positive number');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const listing = await Listing.findOne({ slug });
  if (!listing) {
    console.error(`Listing not found for slug: ${slug}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        slug: listing.slug,
        before: { price: listing.price, area: listing.area },
        after: { price, area: area ?? listing.area },
        dryRun,
      },
      null,
      2
    )
  );

  if (!dryRun) {
    listing.price = price;
    if (area != null) listing.area = area;
    await listing.save();
    console.log('Updated.');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
