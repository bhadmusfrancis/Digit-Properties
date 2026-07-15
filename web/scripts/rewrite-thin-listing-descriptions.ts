/**
 * Rewrite listing descriptions shorter than 250 plain-text characters into human-readable HTML.
 * Keeps the original text on `originalDescription` and tags with `wa-rewritten`.
 * Original chat bodies remain in All_chats.txt, linked via `wa-fp:` fingerprints.
 *
 *   cd web
 *   npx tsx scripts/rewrite-thin-listing-descriptions.ts              # dry-run
 *   npx tsx scripts/rewrite-thin-listing-descriptions.ts --apply        # persist
 *   npx tsx scripts/rewrite-thin-listing-descriptions.ts --limit 50     # sample
 */
import dns from 'node:dns';
import { existsSync } from 'fs';
import path from 'path';
import { mongoUriForConnect } from './lib/mongo-uri';
import {
  buildHumanListingDescriptionHtml,
  humanListingDescriptionInputFromDoc,
  MIN_HUMAN_REWRITE_DESCRIPTION_LEN,
  shouldHumanizeListingDescription,
} from '../src/lib/listing-human-description';
import { LISTING_STATUS } from '../src/lib/constants';
import { isWhatsAppImportTags } from '../src/lib/listing-seo-prep';
import { prepareWhatsAppListingDescription } from '../src/lib/whatsapp-listing-parser';
import { stripHtml } from '../src/lib/utils';
import { mergeUniqueLists } from '../src/lib/listing-amenities';

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

  let cursor = Listing.find({ status: LISTING_STATUS.ACTIVE })
    .select(
      'title description originalDescription price listingType rentPeriod propertyType propertyTypes location bedrooms bathrooms toilets area amenities tags'
    )
    .sort({ updatedAt: 1 })
    .lean();

  if (limit) cursor = cursor.limit(limit);

  const rows = await cursor;
  let candidates = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const tags = Array.isArray(row.tags) ? row.tags.map(String) : [];
    const existingOriginal =
      typeof (row as { originalDescription?: string }).originalDescription === 'string'
        ? String((row as { originalDescription?: string }).originalDescription).trim()
        : '';
    const descRaw = String(row.description ?? '');
    // Prefer previously saved original; otherwise use current description (WhatsApp-normalized when import).
    const sourcePlain = existingOriginal
      ? existingOriginal
      : isWhatsAppImportTags(tags)
        ? prepareWhatsAppListingDescription(descRaw)
        : stripHtml(descRaw).trim();

    if (!shouldHumanizeListingDescription(sourcePlain)) {
      skipped++;
      continue;
    }

    candidates++;
    const next = buildHumanListingDescriptionHtml(
      humanListingDescriptionInputFromDoc({ ...row, description: sourcePlain })
    );
    const currentPlain = stripHtml(descRaw).trim();
    const nextPlain = stripHtml(next).trim();
    if (currentPlain === nextPlain && existingOriginal) {
      skipped++;
      continue;
    }

    updated++;
    const preview = String(row.title ?? row._id).slice(0, 60);
    console.log(
      `${apply ? 'update' : 'would update'}: ${preview} (${sourcePlain.length} → ~${nextPlain.length} chars)`
    );

    if (apply) {
      await Listing.findByIdAndUpdate(row._id, {
        $set: {
          description: next,
          originalDescription: sourcePlain,
          tags: mergeUniqueLists(tags, ['wa-rewritten']),
        },
      });
    }
  }

  console.log(
    `\nScanned: ${rows.length} | under ${MIN_HUMAN_REWRITE_DESCRIPTION_LEN} chars: ${candidates} | ${apply ? 'updated' : 'would update'}: ${updated} | skipped: ${skipped}`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
