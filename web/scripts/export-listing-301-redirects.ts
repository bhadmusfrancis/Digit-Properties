/**
 * Write next.config 301s for every listing slug move and deleted-listing path.
 *
 *   npx tsx scripts/export-listing-301-redirects.ts
 *
 * Loaded by next.config.js so Google gets HTTP 301 (Moved Permanently), not RSC 308.
 */

import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { mongoUriForConnect, normalizeMongoUri } from './lib/mongo-uri';

const RESERVED = new Set(['in', 'new']);
const OUT_FILE = path.resolve(process.cwd(), 'listing-301-redirects.generated.json');

type NextRedirect = {
  source: string;
  destination: string;
  statusCode: 301;
};

function isSafeSegment(raw: string): boolean {
  const s = raw.trim();
  if (!s || RESERVED.has(s)) return false;
  if (/[/?#:]/.test(s)) return false;
  return true;
}

function listingPath(segment: string): string {
  return `/listings/${segment}`;
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  const mongoUri = normalizeMongoUri(process.env.MONGODB_URI);
  if (!mongoUri) {
    console.error('MONGODB_URI missing or invalid (must start with mongodb:// or mongodb+srv://)');
    process.exit(1);
  }

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const ListingPathRedirect = (await import('../src/models/ListingPathRedirect')).default;

  await mongoose.connect(mongoUriForConnect(mongoUri));

  const [movedListings, allSlugs, tombstones] = await Promise.all([
    Listing.find({
      slug: { $exists: true, $nin: [null, ''] },
      previousSlugs: { $exists: true, $ne: [] },
    })
      .select('slug previousSlugs')
      .lean(),
    Listing.distinct('slug', { slug: { $exists: true, $nin: [null, ''] } }),
    ListingPathRedirect.find().select('pathSegment destinationPath').lean(),
  ]);

  const currentSlugs = new Set<string>();
  for (const raw of allSlugs) {
    const slug = String(raw ?? '').trim();
    if (isSafeSegment(slug)) currentSlugs.add(slug);
  }

  const bySource = new Map<string, string>();

  const flattenRedirects = (input: Map<string, string>): Map<string, string> => {
    const flat = new Map<string, string>();
    for (const [source, dest] of input) {
      const seen = new Set<string>([source]);
      let cur = dest;
      while (input.has(cur) && !seen.has(cur)) {
        seen.add(cur);
        cur = input.get(cur)!;
      }
      if (input.has(cur) && seen.has(cur)) continue;
      if (cur.startsWith('/') && cur !== source) flat.set(source, cur);
    }
    return flat;
  };

  const addExact = (fromSegment: string, destPath: string) => {
    if (!isSafeSegment(fromSegment)) return;
    if (currentSlugs.has(fromSegment)) return;
    const source = listingPath(fromSegment);
    const dest = destPath.trim();
    if (!dest.startsWith('/') || dest === source) return;
    if (bySource.has(source)) return;
    bySource.set(source, dest);
  };

  for (const row of movedListings) {
    const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
    if (!isSafeSegment(slug)) continue;
    const dest = listingPath(slug);
    for (const prev of row.previousSlugs ?? []) {
      addExact(String(prev), dest);
    }
  }

  for (const row of tombstones) {
    addExact(String(row.pathSegment ?? ''), String(row.destinationPath ?? ''));
  }

  const flattened = flattenRedirects(bySource);

  const redirects: NextRedirect[] = [];
  for (const [source, destination] of flattened) {
    redirects.push({ source, destination, statusCode: 301 });
    const destListing = destination.match(/^\/listings\/([^/]+)$/);
    if (destListing && isSafeSegment(destListing[1])) {
      redirects.push({
        source: `${source}/:path*`,
        destination: `${destination}/:path*`,
        statusCode: 301,
      });
    }
  }

  writeFileSync(OUT_FILE, `${JSON.stringify(redirects, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${redirects.length} redirects to ${path.basename(OUT_FILE)}`);
  console.log({
    liveSlugMoves: movedListings.length,
    exactPaths: flattened.size,
    withSubpath: redirects.filter((r) => r.source.endsWith('/:path*')).length,
    tombstones: tombstones.length,
  });

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
