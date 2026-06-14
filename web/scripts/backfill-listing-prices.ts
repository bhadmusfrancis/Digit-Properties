/**
 * Fix WhatsApp-import listings where agency/legal/caution % fees were stored as the price.
 *
 * Usage:
 *   npx tsx scripts/backfill-listing-prices.ts
 *   npx tsx scripts/backfill-listing-prices.ts --apply
 *   npx tsx scripts/backfill-listing-prices.ts --slug 4-bed-terrace-at-osapa-london-lekki-lagos-lekki --apply
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import {
  isLikelyMispricedWhatsAppListing,
  reparsedPriceFromDescription,
} from '../src/lib/whatsapp-listing-parser';
import { WHATSAPP_CHAT_IMPORT_TAG } from '../src/lib/listing-seo-prep';
import {
  cleanBodyForParser,
  listingFingerprint,
  parseMessageMeta,
  splitChatMessages,
} from './lib/chat-import-utils';
import { ALL_CHATS_PATH } from './lib/chat-import-paths';

function parseArgs() {
  const argv = process.argv.slice(2);
  const slugIdx = argv.indexOf('--slug');
  return {
    apply: argv.includes('--apply'),
    slug: slugIdx >= 0 ? argv[slugIdx + 1] : undefined,
  };
}

type ListingRow = {
  _id: mongoose.Types.ObjectId;
  slug?: string;
  title?: string;
  price?: number;
  listingType?: string;
  rentPeriod?: string;
  description?: string;
  tags?: string[];
};

function buildChatBodyByFingerprint(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(ALL_CHATS_PATH)) return map;
  const raw = readFileSync(ALL_CHATS_PATH, 'utf8');
  for (const full of splitChatMessages(raw)) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    if (clean.length < 15) continue;
    map.set(listingFingerprint(clean, senderPhone), clean);
  }
  return map;
}

function sourceTextForListing(row: ListingRow, chatBodies: Map<string, string>): string {
  const description = String(row.description ?? '').trim();
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const fpTag = tags.find((t) => t.startsWith('wa-fp:'));
  if (!fpTag) return description;
  const fp = fpTag.slice('wa-fp:'.length);
  const fromChat = chatBodies.get(fp);
  return fromChat && fromChat.length >= description.length * 0.5 ? fromChat : description;
}

async function main() {
  const { apply, slug } = parseArgs();

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing (set in .env.local)');
    process.exit(1);
  }

  const chatBodies = buildChatBodyByFingerprint();
  console.log(`Loaded ${chatBodies.size} chat fingerprints from All_chats.txt`);

  await mongoose.connect(process.env.MONGODB_URI);

  const filter: Record<string, unknown> = { tags: WHATSAPP_CHAT_IMPORT_TAG };
  if (slug) filter.slug = slug;

  const rows = (await Listing.find(filter)
    .select('_id slug title price listingType rentPeriod description tags')
    .lean()
    .exec()) as ListingRow[];

  let scanned = 0;
  let mispriced = 0;
  let updated = 0;
  const samples: Array<{
    id: string;
    slug?: string;
    title?: string;
    before: number;
    after: number;
    reason?: string;
    source: 'description' | 'chat';
  }> = [];

  for (const row of rows) {
    scanned++;
    const description = String(row.description ?? '').trim();
    const sourceText = sourceTextForListing(row, chatBodies);
    if (!sourceText) continue;

    const currentPrice = Number(row.price) || 0;
    const check = isLikelyMispricedWhatsAppListing({
      price: currentPrice,
      listingType: String(row.listingType ?? 'sale'),
      rentPeriod: row.rentPeriod,
      description: sourceText,
    });
    if (!check.mispriced || check.reparsedPrice <= 0) continue;

    mispriced++;
    if (samples.length < 25) {
      samples.push({
        id: String(row._id),
        slug: row.slug,
        title: row.title,
        before: currentPrice,
        after: check.reparsedPrice,
        reason: check.reason,
        source: sourceText === description ? 'description' : 'chat',
      });
    }

    if (!apply) continue;

    const reparsed = reparsedPriceFromDescription(sourceText);
    await Listing.updateOne(
      { _id: row._id },
      {
        $set: {
          price: reparsed.price,
          ...(reparsed.listingType ? { listingType: reparsed.listingType } : {}),
          ...(reparsed.rentPeriod ? { rentPeriod: reparsed.rentPeriod } : {}),
        },
      }
    );
    updated++;
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        mispriced,
        updated: apply ? updated : undefined,
        apply,
        slug: slug ?? null,
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
