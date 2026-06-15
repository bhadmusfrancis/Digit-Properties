/**
 * Strip leftover WhatsApp chat-export artifacts (message headers with
 * timestamps, sender names and phone numbers, attachment markers) from listing
 * titles and descriptions. These leaked in via earlier imports where the
 * "double-tilde" header format was not parsed, e.g.
 *
 *   [5/19/26, 4:00:33 AM] ~ ~ Engr Otaoghene(COREN) ~ (+234 706 735 0185): Wuye listing!
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
import { stripChatArtifacts } from '../src/lib/whatsapp-listing-parser';

function parseArgs() {
  const argv = process.argv.slice(2);
  return { apply: argv.includes('--apply') };
}

type ListingRow = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  description?: string;
};

/** Cheap pre-filter so we only inspect rows that plausibly contain chat junk. */
const SUSPECT_RE = /\[\d{1,2}\/\d{1,2}\/\d{2,4}|~\s*\(|<attached:|\bimage omitted\b/i;

const FALLBACK_DESCRIPTION = 'Imported from WhatsApp.';

async function main() {
  const { apply } = parseArgs();

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing (set in .env.local)');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const rows = (await Listing.find({
    $or: [
      { description: { $regex: SUSPECT_RE } },
      { title: { $regex: SUSPECT_RE } },
    ],
  })
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

    let afterDesc = stripChatArtifacts(beforeDesc);
    if (!afterDesc.trim()) afterDesc = FALLBACK_DESCRIPTION;
    const afterTitle = stripChatArtifacts(beforeTitle) || beforeTitle;

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
        matchedSuspect: rows.length,
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
