/**
 * Strip leftover WhatsApp chat-export artifacts and embedded phone numbers from
 * listing titles and descriptions. Phone contact belongs in agentPhone fields.
 *
 * Usage:
 *   cd web
 *   npx tsx scripts/cleanup-listing-chat-artifacts.ts          # dry-run (default)
 *   npx tsx scripts/cleanup-listing-chat-artifacts.ts --apply  # persist changes
 */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { stripChatArtifacts, stripContactPhonesFromText } from '../src/lib/whatsapp-listing-parser';

function parseArgs() {
  const argv = process.argv.slice(2);
  return { apply: argv.includes('--apply') };
}

type ListingRow = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  description?: string;
};

/** Cheap pre-filter so we only inspect rows that plausibly contain chat junk or phones. */
const SUSPECT_RE =
  /\[\d{1,2}\/\d{1,2}\/\d{2,4}|~\s*\(|<attached:|\bimage omitted\b|\b0[789]\d{9}\b|\+?\s*234[\s.\-]?\d{3}[\s.\-]?\d{3}[\s.\-]?\d{4}/i;

const FALLBACK_DESCRIPTION = 'Imported from WhatsApp.';

function cleanListingCopy(raw: string, fallback = ''): string {
  let out = stripContactPhonesFromText(stripChatArtifacts(raw));
  if (!out.trim()) out = fallback;
  return out;
}

async function main() {
  const { apply } = parseArgs();

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing (set in .env.local)');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const rows = (await Listing.find({})
    .select('_id title description')
    .lean()
    .exec()) as ListingRow[];

  let scanned = 0;
  let changed = 0;
  const samples: Array<{ id: string; field: string; before: string; after: string }> = [];

  for (const row of rows) {
    scanned++;
    const beforeDesc = String(row.description ?? '');
    const beforeTitle = String(row.title ?? '');

    let afterDesc = cleanListingCopy(beforeDesc, FALLBACK_DESCRIPTION);
    const afterTitle = cleanListingCopy(beforeTitle) || beforeTitle;

    const update: Record<string, string> = {};
    if (afterDesc !== beforeDesc) {
      update.description = afterDesc.slice(0, 5000);
      if (samples.length < 20) {
        samples.push({
          id: String(row._id),
          field: 'description',
          before: beforeDesc.slice(0, 160),
          after: afterDesc.slice(0, 160),
        });
      }
    }
    if (afterTitle !== beforeTitle) {
      update.title = afterTitle.slice(0, 200);
      if (samples.length < 20) {
        samples.push({
          id: String(row._id),
          field: 'title',
          before: beforeTitle.slice(0, 160),
          after: afterTitle.slice(0, 160),
        });
      }
    }

    if (Object.keys(update).length === 0) continue;
    changed++;
    if (apply) {
      await Listing.updateOne({ _id: row._id }, { $set: update });
    }
  }

  console.log(
    JSON.stringify(
      {
        apply,
        matchedTotal: rows.length,
        matchedSuspect: rows.filter(
          (r) => SUSPECT_RE.test(String(r.description ?? '')) || SUSPECT_RE.test(String(r.title ?? ''))
        ).length,
        scanned,
        changed,
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
