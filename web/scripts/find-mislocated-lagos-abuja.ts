/**
 * Find Lagos listings whose original/seller text clearly points elsewhere (e.g. Abuja).
 *
 *   npx tsx scripts/find-mislocated-lagos-abuja.ts
 */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { resolveNigeriaPlaceFromText } from '../src/lib/nigeria-place-resolve';
import { stripHtml } from '../src/lib/utils';
import { mongoUriForConnect } from './lib/mongo-uri';

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const specific = await Listing.findOne({
    $or: [
      { slug: '1400-sqm-commercial-at-lagos-lagos' },
      { previousSlugs: '1400-sqm-commercial-at-lagos-lagos' },
    ],
  })
    .select('slug title price area location description originalDescription')
    .lean();

  if (specific) {
    const blob = [
      String(specific.title || ''),
      String(specific.originalDescription || stripHtml(String(specific.description || ''))),
      String(specific.location?.address || ''),
    ].join('\n');
    console.log(
      'SPECIFIC:',
      JSON.stringify(
        {
          slug: specific.slug,
          title: specific.title,
          location: specific.location,
          resolve: resolveNigeriaPlaceFromText(blob),
        },
        null,
        2
      )
    );
  } else {
    console.log('SPECIFIC: not found');
  }

  const lagos = await Listing.find({ 'location.state': 'Lagos' })
    .select('slug title location description originalDescription')
    .lean();

  const rows = [];
  for (const row of lagos) {
    const original =
      typeof row.originalDescription === 'string' ? row.originalDescription.trim() : '';
    const blob = [
      String(row.title || ''),
      original || stripHtml(String(row.description || '')),
      String(row.location?.address || ''),
    ].join('\n');
    const hit = resolveNigeriaPlaceFromText(blob);
    if (!hit || hit.state === 'Lagos') continue;
    rows.push({
      slug: row.slug,
      title: row.title,
      loc: row.location,
      hit,
    });
  }

  console.log('\nMISLOCATED_COUNT:', rows.length);
  console.log(JSON.stringify(rows, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
