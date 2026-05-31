/**
 * Re-resolve listing state/city/suburb from title + description + address using the
 * Nigeria state→city→suburb gazetteer, then regenerate canonical titles (and slugs).
 *
 *   cd web
 *   npx tsx scripts/backfill-listing-location-from-gazetteer.ts
 *   npx tsx scripts/backfill-listing-location-from-gazetteer.ts --apply
 *   npx tsx scripts/backfill-listing-location-from-gazetteer.ts --apply --tag whatsapp-chat-import
 */

import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { buildCanonicalListingTitle } from '../src/lib/listing-title';
import { ensureUniqueListingSlug } from '../src/lib/listing-slug';
import { resolveNigeriaPlaceFromText, type ResolvedNigeriaPlace } from '../src/lib/nigeria-place-resolve';
import { stripHtml } from '../src/lib/utils';
import { mongoUriForConnect } from './lib/mongo-uri';

function parseArgs() {
  const argv = process.argv.slice(2);
  let tagFilter: string | undefined;
  const tagIdx = argv.indexOf('--tag');
  if (tagIdx >= 0 && argv[tagIdx + 1]) tagFilter = argv[tagIdx + 1];
  return { apply: argv.includes('--apply'), tagFilter };
}

type ListingRow = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  description?: string;
  listingType?: string;
  propertyType?: string;
  propertyTypes?: string[];
  bedrooms?: number;
  area?: number;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    suburb?: string;
  };
  slug?: string;
  tags?: string[];
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
    area: typeof row.area === 'number' ? row.area : undefined,
  };
}

function locationBlob(row: ListingRow): string {
  const loc = row.location ?? {};
  const parts = [
    typeof row.description === 'string' ? stripHtml(row.description) : '',
    typeof loc.address === 'string' ? loc.address : '',
  ];
  return parts.join('\n');
}

function structuredAddressFromHit(hit: ResolvedNigeriaPlace): string {
  const parts = [hit.suburb, hit.city, hit.state]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);
  return Array.from(new Map(parts.map((p) => [p.toLowerCase(), p])).values()).join(', ');
}

async function main() {
  const { apply, tagFilter } = parseArgs();

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing (set in .env.local)');
    process.exit(1);
  }

  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const query: Record<string, unknown> = {};
  if (tagFilter) query.tags = tagFilter;

  const rows = (await Listing.find(query)
    .select(
      '_id title description listingType propertyType propertyTypes bedrooms area location slug tags'
    )
    .lean()
    .exec()) as ListingRow[];

  let scanned = 0;
  let locationUpdates = 0;
  let titleOnlyUpdates = 0;
  let slugUpdates = 0;
  const samples: Array<{
    id: string;
    beforeLoc?: unknown;
    afterLoc?: unknown;
    titleBefore?: string;
    titleAfter?: string;
  }> = [];

  for (const row of rows) {
    scanned++;
    const loc = row.location ?? {};
    const prevAddr = typeof loc.address === 'string' ? loc.address.trim() : '';

    const hit = resolveNigeriaPlaceFromText(locationBlob(row));

    if (hit) {
      const stateWas = typeof loc.state === 'string' ? loc.state : '';
      const cityWas = typeof loc.city === 'string' ? loc.city : '';
      const suburbWas = typeof loc.suburb === 'string' ? loc.suburb : '';

      const locChanged =
        hit.state !== stateWas || hit.city !== cityWas || (hit.suburb ?? '') !== (suburbWas ?? '');

      const nextAddress = prevAddr.length >= 5 ? prevAddr : structuredAddressFromHit(hit);

      const rowForTitle: ListingRow = {
        ...row,
        location: {
          ...loc,
          address: nextAddress,
          city: hit.city,
          state: hit.state,
          ...(hit.suburb ? { suburb: hit.suburb } : {}),
        },
      };
      if (!hit.suburb && rowForTitle.location) delete rowForTitle.location.suburb;

      const newTitle = buildCanonicalListingTitle(titleInputFromRow(rowForTitle));
      const beforeTitle = String(row.title ?? '').trim();

      if (locChanged) {
        locationUpdates++;
        if (samples.length < 15) {
          samples.push({
            id: String(row._id),
            beforeLoc: { state: stateWas, city: cityWas, suburb: suburbWas },
            afterLoc: { state: hit.state, city: hit.city, suburb: hit.suburb },
            titleBefore: row.title,
            titleAfter: newTitle,
          });
        }
      } else if (beforeTitle !== newTitle) {
        titleOnlyUpdates++;
        if (samples.length < 15) {
          samples.push({
            id: String(row._id),
            titleBefore: beforeTitle,
            titleAfter: newTitle,
          });
        }
      }

      if (beforeTitle === newTitle && !locChanged) continue;

      if (!apply) continue;

      const slug = await ensureUniqueListingSlug({
        title: newTitle,
        location: rowForTitle.location,
        excludeId: String(row._id),
      });
      if (slug !== String(row.slug ?? '')) slugUpdates++;

      const $set: Record<string, unknown> = {
        title: newTitle,
        slug,
        'location.address': nextAddress,
        'location.city': hit.city,
        'location.state': hit.state,
      };

      const updateOp: Record<string, unknown> = { $set };
      if (hit.suburb) $set['location.suburb'] = hit.suburb;
      else if (suburbWas) updateOp.$unset = { 'location.suburb': '' };

      await Listing.updateOne({ _id: row._id }, updateOp);
      continue;
    }

    const beforeTitle = String(row.title ?? '').trim();
    const afterTitle = buildCanonicalListingTitle(titleInputFromRow(row));
    if (beforeTitle === afterTitle) continue;

    titleOnlyUpdates++;
    if (samples.length < 15) {
      samples.push({
        id: String(row._id),
        titleBefore: beforeTitle,
        titleAfter: afterTitle,
      });
    }

    if (!apply) continue;

    const slug = await ensureUniqueListingSlug({
      title: afterTitle,
      location: row.location,
      excludeId: String(row._id),
    });
    if (slug !== String(row.slug ?? '')) slugUpdates++;

    await Listing.updateOne({ _id: row._id }, { $set: { title: afterTitle, slug } });
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        locationFieldUpdates: locationUpdates,
        titleRegenerations: locationUpdates + titleOnlyUpdates,
        slugUpdates: apply ? slugUpdates : undefined,
        tagFilter: tagFilter ?? null,
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
