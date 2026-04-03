/**
 * Fix listings that wrongly use "Victoria Island" in title/location.
 * Heuristic:
 * - Candidate: title/address/city contains Victoria Island
 * - Skip when description explicitly mentions Victoria Island or standalone VI
 * - Infer replacement from description keywords
 *
 * Usage:
 *   npx tsx scripts/fix-false-victoria-island.ts
 *   npx tsx scripts/fix-false-victoria-island.ts --apply
 */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    apply: argv.includes('--apply'),
    reportUnresolved: argv.includes('--report-unresolved'),
  };
}

/** Location keyword → city/state. Longer keys matched first (see inferFromDescription). */
const INFER_AREA: Record<string, { city: string; state: string }> = {
  'osbourne phase 2': { city: 'Ikoyi', state: 'Lagos' },
  'isheri-oshun': { city: 'Isheri-Oshun', state: 'Lagos' },
  'isheri oshun': { city: 'Isheri-Oshun', state: 'Lagos' },
  'port harcourt': { city: 'Port Harcourt', state: 'Rivers' },
  'banana island': { city: 'Ikoyi', state: 'Lagos' },
  'katampe extension': { city: 'Katampe', state: 'FCT' },
  'games village': { city: 'Kaura', state: 'FCT' },
  'area one': { city: 'Garki', state: 'FCT' },
  'mojisola onikoyi': { city: 'Ikoyi', state: 'Lagos' },
  'igbo efon': { city: 'Lekki', state: 'Lagos' },
  'tiper garage': { city: 'Ketu', state: 'Lagos' },
  'old ikoyi': { city: 'Ikoyi', state: 'Lagos' },
  'ph city': { city: 'Port Harcourt', state: 'Rivers' },
  'tipper garage': { city: 'Akute', state: 'Ogun' },
  'sangotedo': { city: 'Sangotedo', state: 'Lagos' },
  'katampe': { city: 'Katampe', state: 'FCT' },
  'ijebu east': { city: 'Ijebu', state: 'Ogun' },
  'ijanikin': { city: 'Ijanikin', state: 'Lagos' },
  'sango otta': { city: 'Sango Ota', state: 'Ogun' },
  'ado odo': { city: 'Ado-Odo', state: 'Ogun' },
  'ijuri': { city: 'Agbara', state: 'Ogun' },
  'ikota': { city: 'Ikota', state: 'Lagos' },
  'lekki': { city: 'Lekki', state: 'Lagos' },
  'leeki': { city: 'Lekki', state: 'Lagos' },
  'oniru': { city: 'Oniru', state: 'Lagos' },
  'ajah': { city: 'Ajah', state: 'Lagos' },
  'ikoyi': { city: 'Ikoyi', state: 'Lagos' },
  'ikeja': { city: 'Ikeja', state: 'Lagos' },
  'yaba': { city: 'Yaba', state: 'Lagos' },
  'surulere': { city: 'Surulere', state: 'Lagos' },
  'gbagada': { city: 'Gbagada', state: 'Lagos' },
  'maryland': { city: 'Maryland', state: 'Lagos' },
  'ilupeju': { city: 'Ilupeju', state: 'Lagos' },
  'maitama': { city: 'Maitama', state: 'FCT' },
  'garki': { city: 'Garki', state: 'FCT' },
  'wuse': { city: 'Wuse', state: 'FCT' },
  'asokoro': { city: 'Asokoro', state: 'FCT' },
  'chevron': { city: 'Lekki', state: 'Lagos' },
  'jakande': { city: 'Lekki', state: 'Lagos' },
  'osbourne': { city: 'Ikoyi', state: 'Lagos' },
  'isheri': { city: 'Isheri-Oshun', state: 'Lagos' },
  'festac': { city: 'Festac', state: 'Lagos' },
  'abuja': { city: 'Abuja', state: 'FCT' },
  'lagos island': { city: 'Lagos Island', state: 'Lagos' },
  'jolasco': { city: 'Akute', state: 'Ogun' },
  'akute': { city: 'Akute', state: 'Ogun' },
  'ikotun': { city: 'Ikotun', state: 'Lagos' },
  'ikotun lagos': { city: 'Ikotun', state: 'Lagos' },
  'igbesa': { city: 'Igbesa', state: 'Ogun' },
  'agbara': { city: 'Agbara', state: 'Ogun' },
  'ibafo': { city: 'Ibafo', state: 'Ogun' },
  'ojo': { city: 'Ojo', state: 'Lagos' },
  'agege': { city: 'Agege', state: 'Lagos' },
  'mushin': { city: 'Mushin', state: 'Lagos' },
  'ogba': { city: 'Ogba', state: 'Lagos' },
  'berger': { city: 'Ojodu-Berger', state: 'Lagos' },
  'ojodu': { city: 'Ojodu', state: 'Lagos' },
  'igando': { city: 'Igando', state: 'Lagos' },
  'elliott': { city: 'Ishaga', state: 'Lagos' },
  'ishaga': { city: 'Ishaga', state: 'Lagos' },
  'ketu': { city: 'Ketu', state: 'Lagos' },
};

const AREA_KEYS_SORTED = Object.entries(INFER_AREA)
  .map(([key, loc]) => ({ key, ...loc }))
  .sort((a, b) => b.key.length - a.key.length);

function mentions(text: string, phrase: string): boolean {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${esc}\\b`, 'i').test(text);
}

function hasRealVI(description: string): boolean {
  return mentions(description, 'victoria island') || mentions(description, 'vi');
}

function inferFromDescription(description: string): { city: string; state: string } | null {
  for (const a of AREA_KEYS_SORTED) {
    if (mentions(description, a.key)) return { city: a.city, state: a.state };
  }
  return null;
}

function cleanSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

async function main() {
  const { apply, reportUnresolved } = parseArgs();
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');

  await mongoose.connect(process.env.MONGODB_URI);
  const rows = (await Listing.find({
    $or: [
      { title: /\bvictoria\s+island\b/i },
      { 'location.city': /\bvictoria\s+island\b/i },
      { 'location.address': /\bvictoria\s+island\b/i },
    ],
  })
    .select('_id title description location')
    .lean()) as Array<{
    _id: mongoose.Types.ObjectId;
    title?: string;
    description?: string;
    location?: { address?: string; city?: string; state?: string; suburb?: string };
  }>;

  let scanned = 0;
  let changed = 0;
  const sample: Array<{ id: string; fromTitle: string; toTitle: string; toCity: string }> = [];
  const unresolved: Array<{ id: string; title: string; city: string; address: string; reason: string; descriptionSnippet: string }> = [];
  const ops: Array<{ updateOne: { filter: { _id: mongoose.Types.ObjectId }; update: { $set: { title: string; location: { address: string; city: string; state: string; suburb?: string } } } } }> = [];

  for (const row of rows) {
    scanned++;
    const description = `${row.description ?? ''}`;
    if (hasRealVI(description)) {
      if (reportUnresolved) {
        unresolved.push({
          id: String(row._id),
          title: row.title ?? '',
          city: row.location?.city ?? '',
          address: row.location?.address ?? '',
          reason: 'description_explicitly_mentions_vi',
          descriptionSnippet: cleanSpace(description).slice(0, 180),
        });
      }
      continue;
    }

    const inferred = inferFromDescription(description.toLowerCase());
    if (!inferred) {
      if (reportUnresolved) {
        unresolved.push({
          id: String(row._id),
          title: row.title ?? '',
          city: row.location?.city ?? '',
          address: row.location?.address ?? '',
          reason: 'no_known_area_keyword_matched',
          descriptionSnippet: cleanSpace(description).slice(0, 180),
        });
      }
      continue;
    }

    const oldTitle = row.title ?? '';
    const newTitle = cleanSpace(
      oldTitle
        .replace(/\bvictoria\s+island\b/gi, inferred.city)
        .replace(/\bVI\b/g, inferred.city)
    );
    if (!newTitle || newTitle === oldTitle) {
      if (reportUnresolved) {
        unresolved.push({
          id: String(row._id),
          title: row.title ?? '',
          city: row.location?.city ?? '',
          address: row.location?.address ?? '',
          reason: 'title_not_rewritable_but_location_matches_vi',
          descriptionSnippet: cleanSpace(description).slice(0, 180),
        });
      }
      continue;
    }

    const oldLoc = row.location ?? {};
    let address = cleanSpace(String(oldLoc.address ?? '').replace(/\bvictoria\s+island\b/gi, inferred.city));
    if (!address) {
      address = `${inferred.city}, ${inferred.state}`;
    } else if (inferred.state !== 'Lagos') {
      const lagosSuffix = /,?\s*lagos\s*$/i;
      if (lagosSuffix.test(address)) address = cleanSpace(address.replace(lagosSuffix, `, ${inferred.state}`));
    }
    const nextLoc = {
      address,
      city: inferred.city,
      state: inferred.state,
      ...(oldLoc.suburb ? { suburb: cleanSpace(String(oldLoc.suburb).replace(/\bvictoria\s+island\b/gi, inferred.city)) } : {}),
    };

    changed++;
    if (sample.length < 12) {
      sample.push({
        id: String(row._id),
        fromTitle: oldTitle,
        toTitle: newTitle,
        toCity: inferred.city,
      });
    }
    if (apply) {
      ops.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { title: newTitle, location: nextLoc } },
        },
      });
    }
  }

  let modified = 0;
  if (apply && ops.length > 0) {
    const res = await Listing.bulkWrite(ops, { ordered: false });
    modified = res.modifiedCount ?? 0;
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        changed,
        apply,
        modified,
        sample,
        unresolvedCount: unresolved.length,
        unresolved: reportUnresolved ? unresolved : undefined,
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

