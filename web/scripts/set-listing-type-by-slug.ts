/**
 * Set listingType (and optional rentPeriod / market status) by slug.
 *
 *   npx tsx scripts/set-listing-type-by-slug.ts <slug> rent [--period year|month|day] [--dry-run]
 *   npx tsx scripts/set-listing-type-by-slug.ts <slug> sale [--dry-run]
 *
 * If a rent listing has soldAt set (misclassified), moves soldAt → rentedAt unless
 * --keep-market-status is passed.
 */

import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';

function parseArgs() {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a) => !a.startsWith('--'));
  const slug = positional[0] ?? '';
  const listingType = positional[1] ?? '';
  const dryRun = argv.includes('--dry-run');
  const keepMarketStatus = argv.includes('--keep-market-status');
  const periodIdx = argv.indexOf('--period');
  const rentPeriod =
    periodIdx >= 0 && argv[periodIdx + 1] && !argv[periodIdx + 1].startsWith('--')
      ? argv[periodIdx + 1]
      : undefined;
  return { slug, listingType, dryRun, keepMarketStatus, rentPeriod };
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const { slug, listingType, dryRun, keepMarketStatus, rentPeriod } = parseArgs();
  if (!slug || !['sale', 'rent', 'joint_venture'].includes(listingType)) {
    console.error(
      'Usage: npx tsx scripts/set-listing-type-by-slug.ts <slug> <sale|rent|joint_venture> [--period year|month|day] [--dry-run] [--keep-market-status]'
    );
    process.exit(1);
  }

  if (rentPeriod && !['day', 'month', 'year'].includes(rentPeriod)) {
    console.error('--period must be day, month, or year');
    process.exit(1);
  }

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;

  await mongoose.connect(process.env.MONGODB_URI);

  const listing = await Listing.findOne({ slug });
  if (!listing) {
    console.error(`Listing not found for slug: ${slug}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Before:', {
    _id: String(listing._id),
    slug: listing.slug,
    title: listing.title,
    listingType: listing.listingType,
    rentPeriod: listing.rentPeriod,
    price: listing.price,
    soldAt: listing.soldAt,
    rentedAt: listing.rentedAt,
  });

  const update: Record<string, unknown> = { listingType };
  if (listingType === 'rent') {
    update.rentPeriod = rentPeriod ?? listing.rentPeriod ?? 'year';
    if (!keepMarketStatus && listing.soldAt && !listing.rentedAt) {
      update.rentedAt = listing.soldAt;
      update.soldAt = null;
    }
  } else if (listingType === 'sale' && rentPeriod) {
    // ignore --period for sale
  } else if (listingType !== 'rent') {
    update.rentPeriod = undefined;
  }

  if (dryRun) {
    console.log('DRY RUN — would apply:', update);
    await mongoose.disconnect();
    return;
  }

  if (listingType !== 'rent') {
    listing.set('rentPeriod', undefined);
  }
  listing.listingType = listingType as 'sale' | 'rent' | 'joint_venture';
  if (listingType === 'rent') {
    listing.rentPeriod = (update.rentPeriod as 'day' | 'month' | 'year') ?? 'year';
    if (!keepMarketStatus && listing.soldAt && !listing.rentedAt) {
      listing.rentedAt = listing.soldAt;
      listing.soldAt = undefined;
    }
  }

  await listing.save();

  console.log('After:', {
    _id: String(listing._id),
    slug: listing.slug,
    listingType: listing.listingType,
    rentPeriod: listing.rentPeriod,
    soldAt: listing.soldAt,
    rentedAt: listing.rentedAt,
  });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
