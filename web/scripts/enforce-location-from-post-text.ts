/**
 * Enforce listing location fields from post text only (description content).
 * Removes wrong locations (e.g. "Victoria Island") when not present in post text.
 *
 * Usage:
 *   npx tsx scripts/enforce-location-from-post-text.ts
 *   npx tsx scripts/enforce-location-from-post-text.ts --apply
 */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { NIGERIA_STATE_CITY_SUBURBS } from '../src/lib/nigeria-locations';

function parseArgs() {
  const argv = process.argv.slice(2);
  return { apply: argv.includes('--apply') };
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentions(text: string, phrase: string): boolean {
  const p = phrase.trim();
  if (!p) return false;
  const re = new RegExp(`\\b${escapeRe(normalizeText(p))}\\b`, 'i');
  return re.test(text);
}

function extractLocationChunk(description: string): string {
  const direct = description.match(/(?:location|address)\s*[:\-]\s*([^\n\r.]+)/i);
  if (direct?.[1]) return direct[1].trim();
  const locatedIn = description.match(/(?:located\s+in|situated\s+in|in)\s+([^\n\r.]{3,80})/i);
  if (locatedIn?.[1]) return locatedIn[1].trim();
  return '';
}

function titleCase(v: string): string {
  return v
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function cleanLocationToken(v: string): string {
  return v
    .replace(/\b(location|address|axis|community|close to|near|around)\b/gi, ' ')
    .replace(/\bstate\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlausibleLocationToken(v: string): boolean {
  const t = v.trim();
  if (!t) return false;
  if (t.length < 2 || t.length > 48) return false;
  if (/[*%$#@!<>{}]/.test(t)) return false;
  if (/\b(fee|price|sqm|bed|bath|toilet|title|receipt|deed|c of o|document|negotiable|facilitator)\b/i.test(t)) return false;
  return /^[A-Za-z0-9\s'./-]+$/.test(t);
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

  const stateNames = Object.keys(NIGERIA_STATE_CITY_SUBURBS);
  const cityEntries: Array<{ city: string; state: string }> = [];
  for (const state of stateNames) {
    for (const city of Object.keys(NIGERIA_STATE_CITY_SUBURBS[state])) {
      cityEntries.push({ city, state });
    }
  }

  // Longest first helps choose specific names first.
  cityEntries.sort((a, b) => b.city.length - a.city.length);
  stateNames.sort((a, b) => b.length - a.length);

  const rows = (await Listing.find({})
    .select('_id description location')
    .lean()
    .exec()) as Array<{
    _id: mongoose.Types.ObjectId;
    description?: string;
    location?: { address?: string; city?: string; state?: string; suburb?: string };
  }>;

  let scanned = 0;
  let candidates = 0;
  let changed = 0;
  const sample: Array<{
    id: string;
    from: { state?: string; city?: string; suburb?: string };
    to: { state: string; city: string; suburb?: string };
  }> = [];

  const ops: Array<{
    updateOne: {
      filter: { _id: mongoose.Types.ObjectId };
      update: {
        $set: { location: { address: string; city: string; state: string; suburb?: string } };
      };
    };
  }> = [];

  for (const row of rows) {
    scanned++;
    const rawDescription = `${row.description ?? ''}`;
    const text = normalizeText(rawDescription);
    if (!text) continue;
    const locationChunk = extractLocationChunk(rawDescription);
    const chunkText = normalizeText(locationChunk);
    if (!chunkText) continue;

    const matchedStates = stateNames
      .filter((s) => mentions(chunkText, s))
      .sort((a, b) => chunkText.lastIndexOf(normalizeText(a)) - chunkText.lastIndexOf(normalizeText(b)));
    let matchedState = matchedStates.length ? matchedStates[matchedStates.length - 1] : '';

    let matchedCity = '';
    let matchedCityState = '';
    for (const c of cityEntries) {
      if (mentions(chunkText, c.city)) {
        if (!matchedState || c.state === matchedState) {
          matchedCity = c.city;
          matchedCityState = c.state;
          break;
        }
      }
    }

    // Need at least a city in text to do safe overwrite.
    const chunkParts = locationChunk
      .split(/[,\-\/]/g)
      .map((p) => cleanLocationToken(p))
      .filter((p) => Boolean(p) && isPlausibleLocationToken(p));
    if (!matchedCity) continue;
    candidates++;

    const nextState = matchedState || matchedCityState;
    if (!nextState) continue;
    const nextCity = matchedCity;

    // Keep suburb empty in strict mode to avoid injecting ambiguous tokens.
    const nextSuburb = undefined;

    const nextAddress = [nextSuburb, nextCity, nextState].filter(Boolean).join(', ');

    const prevState = (row.location?.state ?? '').trim();
    const prevCity = (row.location?.city ?? '').trim();
    const prevSuburb = (row.location?.suburb ?? '').trim();
    const prevAddress = (row.location?.address ?? '').trim();

    const same =
      normalizeText(prevState) === normalizeText(nextState) &&
      normalizeText(prevCity) === normalizeText(nextCity) &&
      normalizeText(prevSuburb) === normalizeText(nextSuburb ?? '') &&
      normalizeText(prevAddress) === normalizeText(nextAddress);

    if (same) continue;
    changed++;

    if (sample.length < 12) {
      sample.push({
        id: String(row._id),
        from: { state: prevState, city: prevCity, suburb: prevSuburb || undefined },
        to: { state: nextState, city: nextCity, suburb: nextSuburb },
      });
    }

    if (apply) {
      ops.push({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: {
              location: {
                address: nextAddress,
                city: nextCity,
                state: nextState,
                ...(nextSuburb ? { suburb: nextSuburb } : {}),
              },
            },
          },
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
        candidates,
        changed,
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

