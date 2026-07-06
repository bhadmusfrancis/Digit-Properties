/**
 * Delete a single listing by slug (records path redirects like the API).
 *
 *   npx tsx scripts/delete-listing-by-slug.ts <slug> [--dry-run]
 */

import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';

function parseArgs() {
  const argv = process.argv.slice(2);
  const slug = argv.find((a) => !a.startsWith('--')) ?? '';
  const dryRun = argv.includes('--dry-run');
  return { slug, dryRun };
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const { slug, dryRun } = parseArgs();
  if (!slug) {
    console.error('Usage: npx tsx scripts/delete-listing-by-slug.ts <slug> [--dry-run]');
    process.exit(1);
  }

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const { recordListingPathRedirects } = await import('../src/lib/listing-path-redirect');

  await mongoose.connect(process.env.MONGODB_URI);

  const listing = await Listing.findOne({ slug });
  if (!listing) {
    console.error(`Listing not found for slug: ${slug}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log({
    _id: listing._id,
    slug: listing.slug,
    title: listing.title,
    status: listing.status,
    description: String(listing.description).slice(0, 160),
  });

  if (dryRun) {
    console.log('DRY RUN — no delete');
    await mongoose.disconnect();
    return;
  }

  await recordListingPathRedirects({
    _id: listing._id,
    slug: listing.slug,
    previousSlugs: listing.previousSlugs,
    location: listing.location,
  });
  await Listing.findByIdAndDelete(listing._id);
  console.log('Deleted.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
