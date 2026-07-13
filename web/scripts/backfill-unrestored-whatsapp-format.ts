/**
 * Convert humanized HTML descriptions on WhatsApp-import listings that could not
 * be restored from chat exports back to WhatsApp-style plain text (*bold*, newlines).
 *
 *   cd web
 *   npx tsx scripts/backfill-unrestored-whatsapp-format.ts            # dry-run
 *   npx tsx scripts/backfill-unrestored-whatsapp-format.ts --apply    # persist
 *   npx tsx scripts/backfill-unrestored-whatsapp-format.ts --limit 20
 */
import dns from 'node:dns';
import { existsSync } from 'fs';
import path from 'path';
import { mongoUriForConnect } from './lib/mongo-uri';
import {
  ensureWhatsAppStyleDescription,
  looksLikeHumanizedListingHtml,
} from '../src/lib/whatsapp-description';

if (process.platform === 'win32') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

function parseArgs() {
  const apply = process.argv.includes('--apply');
  const limitIdx = process.argv.indexOf('--limit');
  const limit =
    limitIdx >= 0 && process.argv[limitIdx + 1]
      ? Math.max(1, parseInt(process.argv[limitIdx + 1]!, 10) || 0)
      : undefined;
  return { apply, limit };
}

async function main() {
  const { apply, limit } = parseArgs();

  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  let query = Listing.find({
    tags: { $in: ['whatsapp-chat-import', 'whatsapp-import'] },
    description: { $regex: /<[a-z]/i },
  })
    .select('_id title description tags')
    .sort({ updatedAt: 1 })
    .lean();

  if (limit) query = query.limit(limit);

  const rows = (await query) as {
    _id: { toString(): string };
    title?: string;
    description?: string;
    tags?: string[];
  }[];

  let candidates = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const current = String(row.description ?? '');
    if (!looksLikeHumanizedListingHtml(current) && !/<[a-z][\s\S]*>/i.test(current)) {
      skipped++;
      continue;
    }

    const next = ensureWhatsAppStyleDescription(current).slice(0, 5000);
    if (!next || next.trim() === current.trim()) {
      skipped++;
      continue;
    }

    candidates++;
    updated++;
    const preview = String(row.title ?? row._id).slice(0, 55);
    console.log(`${apply ? 'update' : 'would update'}: ${preview}`);
    console.log(`  ${current.length} chars HTML → ${next.length} chars WhatsApp plain`);

    if (apply) {
      await Listing.findByIdAndUpdate(row._id, { $set: { description: next } });
    }
  }

  console.log(
    `\nScanned: ${rows.length} | ${apply ? 'updated' : 'would update'}: ${updated} | skipped: ${skipped} | candidates: ${candidates}`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
