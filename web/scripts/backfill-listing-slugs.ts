/**
 * Backfill SEO slugs for listings missing one.
 * Run: npm run backfill:slugs
 * Requires: MONGODB_URI in .env.local
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

import dns from 'dns';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { ensureUniqueListingSlug } from '../src/lib/listing-slug';

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required in .env.local');
  }

  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  } catch (firstError) {
    if (!uri.startsWith('mongodb+srv://') || !process.env.MONGODB_URI_DIRECT?.trim()) {
      throw firstError;
    }
    console.warn('SRV connect failed; retrying with MONGODB_URI_DIRECT…');
    await mongoose.connect(process.env.MONGODB_URI_DIRECT.trim(), { serverSelectionTimeoutMS: 30000 });
  }

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
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
