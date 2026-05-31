/**
 * Seed `previousSlugs` for listings whose URLs changed after the Akwa Ibom
 * mis-tag fix (generic "housing estate" → Uyo). Only targets listings whose
 * description/address mentions "housing estate" but are no longer in Akwa Ibom.
 *
 *   cd web
 *   npx tsx scripts/backfill-listing-slug-history.ts
 *   npx tsx scripts/backfill-listing-slug-history.ts --apply
 */

import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { buildListingSlugBase } from '../src/lib/listing-slug';
import { stripHtml } from '../src/lib/utils';
import { mongoUriForConnect } from './lib/mongo-uri';

function parseArgs() {
  return { apply: process.argv.slice(2).includes('--apply') };
}

function titleLead(title: string): string {
  const trimmed = title.trim();
  const atIdx = trimmed.toLowerCase().indexOf(' at ');
  return atIdx > 0 ? trimmed.slice(0, atIdx).trim() : trimmed;
}

function inferMisfiledAkwaIbomSlug(title: string): string | null {
  const phrase = titleLead(title);
  if (!phrase) return null;
  const wrongTitle = `${phrase} at Housing Estate, Uyo, Akwa Ibom`;
  return buildListingSlugBase(wrongTitle, { city: 'Uyo', state: 'Akwa Ibom' });
}

async function main() {
  const { apply } = parseArgs();

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const [rows, takenPaths] = await Promise.all([
    Listing.find({ status: 'active' })
      .select('_id title slug previousSlugs location.state location.address description')
      .lean(),
    Listing.find({ $or: [{ slug: { $exists: true, $ne: '' } }, { previousSlugs: { $exists: true, $ne: [] } }] })
      .select('_id slug previousSlugs')
      .lean(),
  ]);

  const reservedByOther = new Map<string, string>();
  for (const doc of takenPaths) {
    const ownerId = String(doc._id);
    const slug = String(doc.slug ?? '').trim();
    if (slug) reservedByOther.set(slug, ownerId);
    for (const prev of doc.previousSlugs ?? []) {
      const p = String(prev).trim();
      if (p) reservedByOther.set(p, ownerId);
    }
  }

  function pathAvailable(candidate: string, ownerId: string): boolean {
    const owner = reservedByOther.get(candidate);
    return !owner || owner === ownerId;
  }

  let candidates = 0;
  let updated = 0;
  const samples: Array<{ id: string; previousSlug: string; currentSlug: string }> = [];

  for (const row of rows) {
    const id = String(row._id);
    const currentSlug = String(row.slug ?? '').trim();
    const state = String(row.location?.state ?? '').trim();
    if (!currentSlug || state === 'Akwa Ibom') continue;
    if (currentSlug.includes('uyo') && currentSlug.includes('akwa-ibom')) continue;

    const copy = [
      stripHtml(String(row.description ?? '')),
      String(row.location?.address ?? ''),
    ]
      .join('\n')
      .toLowerCase();
    if (!/\bhousing\s+estate\b/.test(copy)) continue;

    const inferredSlugs: string[] = [];
    const base = inferMisfiledAkwaIbomSlug(String(row.title ?? ''));
    if (!base || base === currentSlug) continue;
    inferredSlugs.push(base);
    for (let i = 1; i <= 3; i++) inferredSlugs.push(`${base}-${i}`);

    const toAdd = inferredSlugs.filter((candidate) => {
      if (candidate === currentSlug) return false;
      if (Array.isArray(row.previousSlugs) && row.previousSlugs.includes(candidate)) return false;
      return pathAvailable(candidate, id);
    });
    if (!toAdd.length) continue;

    candidates++;
    if (samples.length < 20) {
      samples.push({ id, currentSlug, previousSlug: toAdd.join(', ') });
    }

    if (!apply) continue;

    await Listing.updateOne({ _id: row._id }, { $addToSet: { previousSlugs: { $each: toAdd } } });
    for (const p of toAdd) reservedByOther.set(p, id);
    updated++;
  }

  console.log(JSON.stringify({ scanned: rows.length, candidates, updated: apply ? updated : undefined, apply, samples }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
