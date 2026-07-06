/**
 * Restore WhatsApp line breaks and markup in imported listing descriptions
 * from All_chats.txt (matched by wa-fp fingerprint tag).
 *
 *   cd web
 *   npx tsx scripts/backfill-whatsapp-description-format.ts            # dry-run
 *   npx tsx scripts/backfill-whatsapp-description-format.ts --apply    # persist
 */
import dns from 'node:dns';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
  splitChatMessages,
  parseMessageMeta,
  cleanBodyForParser,
  listingFingerprint,
} from './lib/chat-import-utils';
import { ALL_CHATS_PATH } from './lib/chat-import-paths';
import { mongoUriForConnect } from './lib/mongo-uri';
import { prepareWhatsAppListingDescription } from '../src/lib/whatsapp-listing-parser';

if (process.platform === 'win32') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

function parseArgs() {
  const apply = process.argv.includes('--apply');
  return { apply };
}

function tagValue(tags: string[] | undefined, prefix: string): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.find((t) => typeof t === 'string' && t.startsWith(prefix));
}

async function main() {
  const { apply } = parseArgs();

  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  if (!existsSync(ALL_CHATS_PATH)) {
    console.error(`All_chats.txt not found at ${ALL_CHATS_PATH}`);
    process.exit(1);
  }

  const canonicalRaw = readFileSync(ALL_CHATS_PATH, 'utf8');
  const byFp = new Map<string, string>();
  for (const full of splitChatMessages(canonicalRaw)) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    if (clean.length < 15) continue;
    byFp.set(listingFingerprint(clean, senderPhone), body);
  }
  console.log(`Indexed ${byFp.size} chat messages from All_chats.txt`);

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const rows = (await Listing.find({ tags: 'whatsapp-chat-import' })
    .select('_id title description tags agentPhone')
    .lean()) as {
    _id: { toString(): string };
    title?: string;
    description?: string;
    tags?: string[];
    agentPhone?: string;
  }[];

  let matched = 0;
  let updated = 0;
  let unchanged = 0;
  let noSource = 0;

  for (const row of rows) {
    const fp = tagValue(row.tags, 'wa-fp:')?.slice('wa-fp:'.length);
    if (!fp) {
      noSource++;
      continue;
    }
    const body = byFp.get(fp);
    if (!body) {
      noSource++;
      continue;
    }
    matched++;

    const next = prepareWhatsAppListingDescription(body).slice(0, 5000);
    const current = (row.description ?? '').trim();
    if (current === next.trim()) {
      unchanged++;
      continue;
    }

    updated++;
    const preview = (row.title ?? row._id.toString()).slice(0, 55);
    console.log(`${apply ? 'update' : 'would update'}: ${preview}`);
    if (apply) {
      await Listing.findByIdAndUpdate(row._id, { $set: { description: next } });
    }
  }

  console.log(
    `\nListings: ${rows.length} | matched source: ${matched} | ${apply ? 'updated' : 'would update'}: ${updated} | unchanged: ${unchanged} | no source: ${noSource}`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
