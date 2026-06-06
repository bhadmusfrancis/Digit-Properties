/**
 * Probe listing URLs (404s) and upsert tombstone redirects in ListingPathRedirect.
 *
 * Sources:
 *   --file path.csv          URLs or path segments (GSC export)
 *   --discover-orphans       ObjectIds referenced in DB but listing deleted
 *   --audit-known-paths      Test slug/id/previousSlugs for every listing in DB
 *   --audit-sitemap          Test every URL in live sitemap.xml (report only)
 *
 *   cd web
 *   npx tsx scripts/backfill-listing-path-redirects.ts --discover-orphans
 *   npx tsx scripts/backfill-listing-path-redirects.ts --file ../Search_console_data/404-urls.csv --apply
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import ListingLike from '../src/models/ListingLike';
import SavedListing from '../src/models/SavedListing';
import Claim from '../src/models/Claim';
import ListingProfessionalOffer from '../src/models/ListingProfessionalOffer';
import Payment from '../src/models/Payment';
import Review from '../src/models/Review';
import ListingPathRedirect from '../src/models/ListingPathRedirect';
import { inferRedirectDestinationFromListingSegment } from '../src/lib/infer-listing-redirect';
import { mongoUriForConnect } from './lib/mongo-uri';

const DEFAULT_BASE = 'https://www.digitproperties.com';

type HttpProbe = { status: number; location?: string };

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes('--apply'),
    discoverOrphans: args.includes('--discover-orphans'),
    auditKnownPaths: args.includes('--audit-known-paths'),
    auditSitemap: args.includes('--audit-sitemap'),
    file: (() => {
      const i = args.indexOf('--file');
      return i >= 0 ? args[i + 1] : undefined;
    })(),
    baseUrl: (() => {
      const i = args.indexOf('--base-url');
      return (i >= 0 ? args[i + 1] : DEFAULT_BASE).replace(/\/$/, '');
    })(),
  };
}

function extractListingSegment(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const u = new URL(trimmed);
      const m = u.pathname.match(/^\/listings\/([^/]+)\/?$/);
      return m?.[1] ?? null;
    }
  } catch {
    /* ignore */
  }
  if (trimmed.startsWith('/listings/')) {
    const m = trimmed.match(/^\/listings\/([^/]+)\/?$/);
    return m?.[1] ?? null;
  }
  if (/^[a-zA-Z0-9-]+$/.test(trimmed) && !trimmed.includes('/')) return trimmed;
  return null;
}

function parseUrlFile(filePath: string): string[] {
  const abs = path.resolve(process.cwd(), filePath);
  if (!existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  const text = readFileSync(abs, 'utf8');
  const segments = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    for (const col of cols) {
      const seg = extractListingSegment(col);
      if (seg) segments.add(seg);
    }
  }
  return [...segments];
}

async function probeUrl(url: string): Promise<HttpProbe> {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location') ?? undefined };
  } catch (e) {
    console.error('[probe]', url, e);
    return { status: 0 };
  }
}

async function probeUrlsConcurrent(urls: string[], concurrency = 20): Promise<Map<string, HttpProbe>> {
  const results = new Map<string, HttpProbe>();
  let index = 0;
  async function worker() {
    while (index < urls.length) {
      const i = index++;
      const url = urls[i]!;
      results.set(url, await probeUrl(url));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  return results;
}

async function collectOrphanListingIds(): Promise<string[]> {
  const [listingIds, likeIds, savedIds, claimIds, offerIds, paymentIds, reviewIds] = await Promise.all([
    Listing.distinct('_id'),
    ListingLike.distinct('listingId'),
    SavedListing.distinct('listingId'),
    Claim.distinct('listingId'),
    ListingProfessionalOffer.distinct('listingId'),
    Payment.distinct('listingId'),
    Review.distinct('listingId'),
  ]);
  const existing = new Set(listingIds.map(String));
  const referenced = new Set<string>();
  for (const id of [...likeIds, ...savedIds, ...claimIds, ...offerIds, ...paymentIds, ...reviewIds]) {
    if (id != null) referenced.add(String(id));
  }
  return [...referenced].filter((id) => !existing.has(id));
}

async function segmentHasLiveListing(segment: string): Promise<boolean> {
  const { findListingByPublicParam } = await import('../src/lib/resolve-listing');
  const found = await findListingByPublicParam(segment);
  return found?.type === 'listing';
}

async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const urls: string[] = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    urls.push(m[1]!);
  }
  return urls;
}

async function main() {
  const { apply, discoverOrphans, auditKnownPaths, auditSitemap, file, baseUrl } = parseArgs();

  if (!file && !discoverOrphans && !auditSitemap && !auditKnownPaths) {
    console.error(
      'Usage: npx tsx scripts/backfill-listing-path-redirects.ts (--file path | --discover-orphans | --audit-known-paths | --audit-sitemap) [--apply]'
    );
    process.exit(1);
  }

  if (auditSitemap) {
    const urls = await fetchSitemapUrls(baseUrl);
    const probes = await probeUrlsConcurrent(urls);
    const failures: Array<{ url: string; status: number }> = [];
    for (const url of urls) {
      const status = probes.get(url)?.status ?? 0;
      if (status !== 200 && status !== 301 && status !== 308) {
        failures.push({ url, status });
      }
    }
    console.log(JSON.stringify({ audit: 'sitemap', total: urls.length, failures }, null, 2));
    if (!file && !discoverOrphans && !auditKnownPaths) {
      return;
    }
  }

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const segments = new Set<string>();
  if (file) {
    for (const seg of parseUrlFile(file)) segments.add(seg);
  }
  if (discoverOrphans) {
    for (const id of await collectOrphanListingIds()) segments.add(id);
  }
  if (auditKnownPaths) {
    const rows = await Listing.find({})
      .select('_id slug previousSlugs')
      .lean();
    for (const row of rows) {
      segments.add(String(row._id));
      const slug = String(row.slug ?? '').trim();
      if (slug) segments.add(slug);
      for (const prev of row.previousSlugs ?? []) {
        const p = String(prev).trim();
        if (p) segments.add(p);
      }
    }
  }

  const results: Array<{
    segment: string;
    url: string;
    beforeStatus: number;
    destinationPath: string;
    action: 'skip_live' | 'skip_ok' | 'would_backfill' | 'backfilled' | 'already_tombstone';
  }> = [];

  let backfilled = 0;
  let skippedLive = 0;
  let skippedOk = 0;

  for (const segment of segments) {
    const url = `${baseUrl}/listings/${segment}`;
    if (await segmentHasLiveListing(segment)) {
      skippedLive++;
      results.push({
        segment,
        url,
        beforeStatus: 0,
        destinationPath: '',
        action: 'skip_live',
      });
      continue;
    }

    const existingTombstone = await ListingPathRedirect.findOne({ pathSegment: segment })
      .select('destinationPath')
      .lean();
    if (existingTombstone?.destinationPath) {
      const probe = await probeUrl(url);
      const ok = probe.status === 301 || probe.status === 308 || probe.status === 200;
      results.push({
        segment,
        url,
        beforeStatus: probe.status,
        destinationPath: existingTombstone.destinationPath,
        action: ok ? 'already_tombstone' : 'would_backfill',
      });
      if (!ok && apply) {
        /* re-upsert below */
      } else if (ok) {
        skippedOk++;
        continue;
      }
    }

    const probe = await probeUrl(url);
    if (probe.status !== 404 && probe.status !== 410 && !existingTombstone) {
      skippedOk++;
      results.push({
        segment,
        url,
        beforeStatus: probe.status,
        destinationPath: '',
        action: 'skip_ok',
      });
      continue;
    }

    const destinationPath = inferRedirectDestinationFromListingSegment(segment);
    results.push({
      segment,
      url,
      beforeStatus: probe.status,
      destinationPath,
      action: apply ? 'backfilled' : 'would_backfill',
    });

    if (apply) {
      await ListingPathRedirect.updateOne(
        { pathSegment: segment },
        { $set: { destinationPath } },
        { upsert: true }
      );
      backfilled++;
    }
  }

  const wouldBackfill = results.filter((r) => r.action === 'would_backfill' || r.action === 'backfilled');

  if (apply && wouldBackfill.length > 0) {
    for (const row of wouldBackfill) {
      const after = await probeUrl(row.url);
      row.beforeStatus = after.status;
    }
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        apply,
        segmentsChecked: segments.size,
        skippedLive,
        skippedOk,
        backfilled: apply ? backfilled : undefined,
        wouldBackfill: apply ? undefined : wouldBackfill.length,
        samples: wouldBackfill.slice(0, 30),
        all: wouldBackfill.length <= 100 ? wouldBackfill : undefined,
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
