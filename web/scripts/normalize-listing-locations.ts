/**
 * Normalize all listing location fields in DB.
 * - Trims and collapses whitespace.
 * - Removes repeated values across suburb/city/state/address.
 * - Prevents address from repeating suburb/city/state tokens.
 *
 * Usage:
 *   npx tsx scripts/normalize-listing-locations.ts          # dry-run
 *   npx tsx scripts/normalize-listing-locations.ts --apply  # persist
 */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';

type RawLocation = {
  address?: unknown;
  city?: unknown;
  state?: unknown;
  suburb?: unknown;
};

function parseArgs() {
  const argv = process.argv.slice(2);
  return { apply: argv.includes('--apply') };
}

function normSpace(v: string): string {
  return v.replace(/\s+/g, ' ').trim();
}

function key(v: string): string {
  return normSpace(v).toLowerCase();
}

function toText(v: unknown): string {
  return typeof v === 'string' ? normSpace(v) : '';
}

function dedupOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const val = normSpace(raw);
    if (!val) continue;
    const k = key(val);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(val);
  }
  return out;
}

function cleanAddressParts(address: string): string[] {
  return dedupOrdered(
    address
      .split(/[,-]/g)
      .map((p) => p.trim())
      .filter(Boolean)
  );
}

function normalizeLocation(input: RawLocation): {
  address: string;
  city: string;
  state: string;
  suburb?: string;
} {
  let suburb = toText(input.suburb);
  let city = toText(input.city);
  const state = toText(input.state);
  const address = toText(input.address);

  // If suburb repeats city/state, keep the broader location only.
  if (suburb && (key(suburb) === key(city) || key(suburb) === key(state))) {
    suburb = '';
  }
  // If city repeats state (common in messy imports), keep city as-is.
  // We only prevent repeated display in address below.

  const blocked = new Set(
    [suburb, city, state].filter(Boolean).map((v) => key(v))
  );

  const cleanedAddressParts = cleanAddressParts(address).filter(
    (p) => !blocked.has(key(p))
  );

  const finalAddress = dedupOrdered(cleanedAddressParts).join(', ');

  const rebuiltAddress =
    finalAddress ||
    dedupOrdered([suburb, city, state].filter(Boolean)).join(', ');

  return {
    address: rebuiltAddress,
    city,
    state,
    ...(suburb ? { suburb } : {}),
  };
}

async function main() {
  const { apply } = parseArgs();

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const rows = (await Listing.find({})
    .select('_id location')
    .lean()
    .exec()) as Array<{ _id: mongoose.Types.ObjectId; location?: RawLocation }>;

  let scanned = 0;
  let changed = 0;
  const bulk: Array<{
    updateOne: {
      filter: { _id: mongoose.Types.ObjectId };
      update: { $set: { location: { address: string; city: string; state: string; suburb?: string } } };
    };
  }> = [];

  for (const row of rows) {
    scanned++;
    const loc = row.location ?? {};
    const next = normalizeLocation(loc);

    const prev = {
      address: toText(loc.address),
      city: toText(loc.city),
      state: toText(loc.state),
      suburb: toText(loc.suburb),
    };

    const same =
      key(prev.address) === key(next.address) &&
      key(prev.city) === key(next.city) &&
      key(prev.state) === key(next.state) &&
      key(prev.suburb) === key(next.suburb ?? '');

    if (!same) {
      changed++;
      if (apply) {
        bulk.push({
          updateOne: {
            filter: { _id: row._id },
            update: { $set: { location: next } },
          },
        });
      }
    }
  }

  let modified = 0;
  if (apply && bulk.length > 0) {
    const res = await Listing.bulkWrite(bulk, { ordered: false });
    modified = res.modifiedCount ?? 0;
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        changed,
        apply,
        modified,
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

