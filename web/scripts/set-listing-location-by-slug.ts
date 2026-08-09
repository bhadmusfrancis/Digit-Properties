/**
 * Correct structured location (and regenerate title/slug) for a listing by slug.
 *
 *   npx tsx scripts/set-listing-location-by-slug.ts <slug> --city Ajah --state Lagos [--suburb "Ajayi Apata"] [--dry-run]
 */

import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { mongoUriForConnect } from './lib/mongo-uri';

function parseArgs() {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a) => !a.startsWith('--'));
  const slug = positional[0] ?? '';
  const dryRun = argv.includes('--dry-run');

  const take = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i < 0 || !argv[i + 1] || argv[i + 1].startsWith('--')) return undefined;
    return argv[i + 1];
  };

  return {
    slug,
    dryRun,
    city: take('--city'),
    state: take('--state'),
    suburb: take('--suburb'),
    address: take('--address'),
  };
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const { slug, dryRun, city, state, suburb, address } = parseArgs();
  if (!slug || !city || !state) {
    console.error(
      'Usage: npx tsx scripts/set-listing-location-by-slug.ts <slug> --city <city> --state <state> [--suburb <suburb>] [--address <address>] [--dry-run]'
    );
    process.exit(1);
  }

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const { buildCanonicalListingTitle } = await import('../src/lib/listing-title');
  const { ensureUniqueListingSlug, withSlugHistoryUpdate } = await import('../src/lib/listing-slug');
  const {
    buildHumanListingDescriptionHtml,
    humanListingDescriptionInputFromDoc,
  } = await import('../src/lib/listing-human-description');
  const { stripHtml } = await import('../src/lib/utils');

  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const listing = await Listing.findOne({
    $or: [{ slug }, { previousSlugs: slug }],
  });
  if (!listing) {
    console.error(`Listing not found for slug: ${slug}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const loc = listing.location ?? {};
  const suburbTrim = suburb?.trim();
  const nextLoc = {
    address:
      (address?.trim() ||
        (typeof loc.address === 'string' && loc.address.trim()) ||
        [suburbTrim, city, state].filter(Boolean).join(', ')).trim(),
    city: city.trim(),
    state: state.trim(),
    ...(suburbTrim ? { suburb: suburbTrim } : {}),
  };

  const newTitle = buildCanonicalListingTitle({
    listingType: String(listing.listingType ?? 'sale'),
    propertyType: String(listing.propertyType ?? 'apartment'),
    propertyTypes: Array.isArray(listing.propertyTypes)
      ? listing.propertyTypes.map(String)
      : undefined,
    address: nextLoc.address,
    city: nextLoc.city,
    state: nextLoc.state,
    suburb: nextLoc.suburb,
    bedrooms: typeof listing.bedrooms === 'number' ? listing.bedrooms : 0,
    area: typeof listing.area === 'number' ? listing.area : undefined,
  });

  console.log('Before:', {
    _id: String(listing._id),
    slug: listing.slug,
    title: listing.title,
    location: {
      address: loc.address,
      suburb: loc.suburb,
      city: loc.city,
      state: loc.state,
      coordinates: loc.coordinates,
    },
  });
  console.log('After:', {
    title: newTitle,
    location: nextLoc,
  });

  if (dryRun) {
    console.log('DRY RUN — no write');
    await mongoose.disconnect();
    return;
  }

  const prevSlug = String(listing.slug ?? '').trim();
  const nextSlug = await ensureUniqueListingSlug({
    title: newTitle,
    location: nextLoc,
    excludeId: String(listing._id),
  });

  const $set: Record<string, unknown> = {
    title: newTitle,
    'location.address': nextLoc.address,
    'location.city': nextLoc.city,
    'location.state': nextLoc.state,
  };
  const updateOp: Record<string, unknown> = { $set, $unset: { 'location.coordinates': '' } };
  withSlugHistoryUpdate(updateOp, prevSlug, nextSlug);

  if (nextLoc.suburb) $set['location.suburb'] = nextLoc.suburb;
  else if (loc.suburb) {
    (updateOp.$unset as Record<string, string>)['location.suburb'] = '';
  }

  const original =
    typeof listing.originalDescription === 'string' ? listing.originalDescription.trim() : '';
  const tags = Array.isArray(listing.tags) ? listing.tags.map(String) : [];
  if (original || tags.includes('wa-rewritten')) {
    const sourcePlain = original || stripHtml(String(listing.description ?? '')).trim();
    if (sourcePlain) {
      $set.description = buildHumanListingDescriptionHtml(
        humanListingDescriptionInputFromDoc({
          ...listing.toObject(),
          title: newTitle,
          description: sourcePlain,
          location: nextLoc,
        })
      );
      if (!original) $set.originalDescription = sourcePlain;
    }
  }

  await Listing.updateOne({ _id: listing._id }, updateOp);

  const after = await Listing.findById(listing._id)
    .select('slug title location previousSlugs')
    .lean();
  console.log('Saved:', after);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
