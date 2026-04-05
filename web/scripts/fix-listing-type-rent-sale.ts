/**
 * Fix listings where listingType (sale vs rent) disagrees with title/description/tags.
 * Uses the same signals as WhatsApp import (inferSaleOrRentFromPostCopy).
 *
 * Run from web/:
 *   npx tsx scripts/fix-listing-type-rent-sale.ts
 *   npx tsx scripts/fix-listing-type-rent-sale.ts --apply
 */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { LISTING_TYPE } from '../src/lib/constants';
import { inferSaleOrRentFromPostCopy } from '../src/lib/infer-listing-type-from-post';

function parseArgs() {
  return { apply: process.argv.includes('--apply') };
}

async function main() {
  const { apply } = parseArgs();
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing (set in web/.env.local)');

  await mongoose.connect(process.env.MONGODB_URI);

  const rows = (await Listing.find({
    listingType: { $in: [LISTING_TYPE.SALE, LISTING_TYPE.RENT] },
  })
    .select('_id title description listingType rentPeriod tags')
    .lean()) as Array<{
    _id: mongoose.Types.ObjectId;
    title?: string;
    description?: string;
    listingType?: string;
    rentPeriod?: string;
    tags?: string[];
  }>;

  const ops: Array<{
    updateOne: {
      filter: { _id: mongoose.Types.ObjectId };
      update: Record<string, unknown>;
    };
  }> = [];
  const sample: Array<{
    id: string;
    title: string;
    from: string;
    to: string;
    rentPeriod?: string;
  }> = [];

  let scanned = 0;
  let wouldChange = 0;

  for (const row of rows) {
    scanned++;
    const current = row.listingType === LISTING_TYPE.RENT ? LISTING_TYPE.RENT : LISTING_TYPE.SALE;
    const inferred = inferSaleOrRentFromPostCopy({
      title: row.title ?? '',
      description: row.description ?? '',
      tags: Array.isArray(row.tags) ? row.tags : [],
    });
    if (!inferred || inferred.listingType === current) continue;

    wouldChange++;
    if (sample.length < 30) {
      sample.push({
        id: String(row._id),
        title: (row.title ?? '').slice(0, 80),
        from: current,
        to: inferred.listingType,
        rentPeriod: inferred.rentPeriod,
      });
    }

    if (apply) {
      if (inferred.listingType === LISTING_TYPE.RENT) {
        ops.push({
          updateOne: {
            filter: { _id: row._id },
            update: {
              $set: {
                listingType: LISTING_TYPE.RENT,
                rentPeriod: inferred.rentPeriod ?? 'year',
              },
            },
          },
        });
      } else {
        ops.push({
          updateOne: {
            filter: { _id: row._id },
            update: {
              $set: { listingType: LISTING_TYPE.SALE },
              $unset: { rentPeriod: 1, leaseDuration: 1 },
            },
          },
        });
      }
    }
  }

  let modified = 0;
  if (apply && ops.length > 0) {
    const res = await Listing.bulkWrite(ops as Parameters<typeof Listing.bulkWrite>[0], { ordered: false });
    modified = res.modifiedCount ?? 0;
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        mismatches: wouldChange,
        apply,
        modified,
        sample,
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
