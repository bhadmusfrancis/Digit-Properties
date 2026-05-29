/**
 * Audit (and optionally fix) listings whose stored propertyType disagrees with
 * the keyword classifier when run against the listing description.
 *
 * Motivation: some imports were classified from an ancillary mention in the
 * post (e.g. a filling station that also lists "5 office Spaces" became an
 * "Office"). The corrected classifier (extractPropertyType) detects fuel
 * stations and prefers the earliest-mentioned asset.
 *
 * Usage:
 *   # Dry-run: review every suggested correction, grouped by from -> to
 *   npx tsx scripts/audit-listing-property-types.ts
 *
 *   # Apply ONLY the high-confidence filling-station corrections
 *   npx tsx scripts/audit-listing-property-types.ts --type=filling_station --apply
 *
 *   # Apply every suggested correction (must opt in with --all)
 *   npx tsx scripts/audit-listing-property-types.ts --apply --all
 *
 * Flags:
 *   --apply             Persist changes (default is dry-run)
 *   --type=<slug>       Only consider listings the classifier now maps to <slug>
 *   --from=<slug>       Only consider listings whose CURRENT type is <slug>
 *   --exclude=<ids>     Comma-separated listing _ids to skip (e.g. multi-parcel briefs)
 *   --all               Required to --apply when no --type filter is given
 *   --limit=<n>         Max sample rows to print per group (default 20)
 *   --out=<file>        Write the full report (all rows) to a JSON file
 */
import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import dns from 'dns';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { extractPropertyType } from '../src/lib/whatsapp-listing-parser';
import { buildCanonicalListingTitle } from '../src/lib/listing-title';
import { ensureUniqueListingSlug } from '../src/lib/listing-slug';

function parseArgs() {
  const argv = process.argv.slice(2);
  const typeArg = argv.find((a) => a.startsWith('--type='));
  const fromArg = argv.find((a) => a.startsWith('--from='));
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const outArg = argv.find((a) => a.startsWith('--out='));
  const excludeArg = argv.find((a) => a.startsWith('--exclude='));
  return {
    apply: argv.includes('--apply'),
    all: argv.includes('--all'),
    type: typeArg ? typeArg.split('=')[1]?.trim() : undefined,
    from: fromArg ? fromArg.split('=')[1]?.trim() : undefined,
    limit: limitArg ? Math.max(1, parseInt(limitArg.split('=')[1], 10) || 20) : 20,
    out: outArg ? outArg.split('=')[1]?.trim() : undefined,
    exclude: new Set(
      (excludeArg ? excludeArg.split('=')[1] ?? '' : '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  };
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
  location?: { address?: string; city?: string; state?: string; suburb?: string };
  slug?: string;
};

function titleInputFromRow(row: ListingRow, propertyType: string) {
  const loc = row.location ?? {};
  return {
    listingType: String(row.listingType ?? 'sale'),
    propertyType,
    propertyTypes: undefined,
    address: typeof loc.address === 'string' ? loc.address : undefined,
    city: typeof loc.city === 'string' ? loc.city : undefined,
    state: typeof loc.state === 'string' ? loc.state : undefined,
    suburb: typeof loc.suburb === 'string' ? loc.suburb : undefined,
    bedrooms: typeof row.bedrooms === 'number' ? row.bedrooms : 0,
    area: typeof row.area === 'number' ? row.area : undefined,
  };
}

function snippet(text: string, n = 140): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

async function main() {
  const { apply, all, type, from, limit, out, exclude } = parseArgs();

  if (apply && !type && !all) {
    console.error(
      'Refusing to bulk-apply without a filter. Re-run with --type=<slug> for a single\n' +
        'category, or pass --all to apply every suggested correction.'
    );
    process.exit(1);
  }

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing (set in .env.local)');
    process.exit(1);
  }

  // Optional DNS override (comma-separated) for environments where Node's
  // default resolver refuses the mongodb+srv SRV lookup. e.g. DNS_SERVERS=8.8.8.8
  if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const rows = (await Listing.find({})
    .select('_id title description listingType propertyType propertyTypes bedrooms area location slug')
    .lean()
    .exec()) as ListingRow[];

  let scanned = 0;
  let mismatches = 0;
  let applied = 0;
  const groupCounts: Record<string, number> = {};
  const samplesByGroup: Record<
    string,
    Array<{ id: string; slug?: string; title?: string; newTitle: string; snippet: string }>
  > = {};
  const allRows: Array<{
    id: string;
    slug?: string;
    current: string;
    suggested: string;
    title?: string;
    newTitle: string;
    listingType?: string;
    snippet: string;
  }> = [];

  for (const row of rows) {
    scanned++;
    const current = String(row.propertyType ?? '').toLowerCase();
    // Classify from the description (original post for imports). The title is
    // auto-derived from propertyType, so feeding it back in would re-confirm a
    // wrong type (e.g. a title of "Office at ..." would re-pick office).
    const source = String(row.description ?? '').trim() || String(row.title ?? '');
    const suggested = extractPropertyType(source);

    if (!suggested || suggested === current) continue;
    if (type && suggested !== type) continue;
    if (from && current !== from) continue;
    if (exclude.has(String(row._id))) continue;

    mismatches++;
    const groupKey = `${current || '(none)'} -> ${suggested}`;
    groupCounts[groupKey] = (groupCounts[groupKey] ?? 0) + 1;

    const newTitle = buildCanonicalListingTitle(titleInputFromRow(row, suggested));

    const bucket = (samplesByGroup[groupKey] ??= []);
    if (bucket.length < limit) {
      bucket.push({
        id: String(row._id),
        slug: row.slug,
        title: row.title,
        newTitle,
        snippet: snippet(row.description ?? row.title ?? ''),
      });
    }

    if (out) {
      allRows.push({
        id: String(row._id),
        slug: row.slug,
        current: current || '(none)',
        suggested,
        title: row.title,
        newTitle,
        listingType: row.listingType,
        snippet: snippet(row.description ?? row.title ?? '', 320),
      });
    }

    if (!apply) continue;

    const existingTypes = Array.isArray(row.propertyTypes)
      ? row.propertyTypes.map((t) => String(t).toLowerCase())
      : [];
    const newPropertyTypes = Array.from(
      new Set([suggested, ...existingTypes.filter((t) => t && t !== current)])
    ).slice(0, 3);

    const slug = await ensureUniqueListingSlug({
      title: newTitle,
      location: row.location,
      excludeId: String(row._id),
    });

    await Listing.updateOne(
      { _id: row._id },
      {
        $set: {
          propertyType: suggested,
          propertyTypes: newPropertyTypes,
          title: newTitle,
          slug,
        },
      }
    );
    applied++;
  }

  if (out) {
    writeFileSync(
      path.resolve(out),
      JSON.stringify({ generatedAt: new Date().toISOString(), scanned, mismatches, groupCounts, rows: allRows }, null, 2)
    );
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        filterType: type ?? null,
        scanned,
        mismatches,
        applied: apply ? applied : undefined,
        out: out ?? undefined,
        groupCounts,
        samplesByGroup,
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
