/**
 * Reconcile All_chats.txt with the listings already in the database.
 *
 * Why: All_chats.txt is the canonical dedup archive used by the chat importer
 * (build_chat_export.py cutoff + isDuplicateOfCanonical). If a listing exists in
 * the DB but its source message is missing from All_chats.txt (e.g. it was
 * imported by the older import-chat-listings.ts that never appended, or the
 * archive drifted), a re-export of the same group can re-create it. This script
 * rebuilds a faithful chat line for every imported listing and appends the ones
 * whose fingerprint is not already represented in All_chats.txt — so the archive
 * matches the current DB (and its current listing titles/bodies) before any new
 * import runs.
 *
 *   cd web
 *   npx tsx scripts/sync-all-chats-from-db.ts            # dry-run report
 *   npx tsx scripts/sync-all-chats-from-db.ts --apply    # append missing entries
 */
import dns from 'node:dns';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import path from 'path';
import {
  splitChatMessages,
  parseMessageMeta,
  cleanBodyForParser,
  listingFingerprint,
  normalizeForDedup,
  bodySimilarity,
  DEDUP_MIN_CHARS,
  DEDUP_SIMILARITY,
} from './lib/chat-import-utils';
import { ALL_CHATS_PATH } from './lib/chat-import-paths';
import { mongoUriForConnect } from './lib/mongo-uri';

if (process.platform === 'win32') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const AUTHOR_EMAIL_DEFAULT = 'fabhainternation@gmail.com';

function parseArgs() {
  const argv = process.argv.slice(2);
  let apply = false;
  let email = AUTHOR_EMAIL_DEFAULT;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') apply = true;
    else if (a === '--email' && argv[i + 1]) email = argv[++i];
  }
  return { apply, email };
}

/** wa-ts:YYYYMMDDHHMMSS → "M/D/YY, h:mm:ss AM" (WhatsApp export header format). */
function chatTsFromTag(tag: string | undefined): string | null {
  if (!tag) return null;
  const m = tag.match(/^wa-ts:(\d{14})$/);
  if (!m) return null;
  const s = m[1];
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  let h = Number(s.slice(8, 10));
  const mi = s.slice(10, 12);
  const se = s.slice(12, 14);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const yy = String(y % 100).padStart(2, '0');
  return `${mo}/${d}/${yy}, ${h}:${mi}:${se} ${ampm}`;
}

function tagValue(tags: string[] | undefined, prefix: string): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.find((t) => typeof t === 'string' && t.startsWith(prefix));
}

async function main() {
  const { apply, email } = parseArgs();

  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  // 1) Index All_chats.txt by fingerprint + keep bodies for fuzzy matching.
  const canonicalRaw = existsSync(ALL_CHATS_PATH) ? readFileSync(ALL_CHATS_PATH, 'utf8') : '';
  const canonicalFps = new Set<string>();
  const canonicalBodies: string[] = [];
  for (const full of splitChatMessages(canonicalRaw)) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    if (clean.length < 15) continue;
    canonicalFps.add(listingFingerprint(clean, senderPhone));
    canonicalBodies.push(clean);
  }
  console.log(`All_chats.txt messages indexed: ${canonicalBodies.length} (unique fp: ${canonicalFps.size})`);

  // 2) Load all imported listings from DB.
  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const User = (await import('../src/models/User')).default;
  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const author = await User.findOne({ email: email.toLowerCase().trim() }).select('_id').lean();
  const query: Record<string, unknown> = { tags: 'whatsapp-chat-import' };
  if (author) query.createdBy = author._id;

  const rows = (await Listing.find(query)
    .select('_id title description agentName agentPhone tags createdAt')
    .sort({ createdAt: 1 })
    .lean()) as {
    _id: { toString(): string };
    title?: string;
    description?: string;
    agentName?: string;
    agentPhone?: string;
    tags?: string[];
    createdAt?: Date;
  }[];

  console.log(`DB imported listings (whatsapp-chat-import): ${rows.length}`);

  // 3) For each listing, rebuild a chat line and decide whether it is already
  //    represented in All_chats.txt (exact fp or fuzzy body match).
  const toAppend: string[] = [];
  let alreadyExact = 0;
  let alreadyFuzzy = 0;
  let noTimestamp = 0;
  const seenInThisRun = new Set<string>();
  const samples: string[] = [];

  for (const row of rows) {
    const body = (row.description ?? '').replace(/\s*\n\s*\(Imported from WhatsApp chat\.\)\s*$/i, '').trim();
    if (body.length < 15) continue;

    // Reconstruct the sender phone the same way parseMessageMeta would, so the
    // fingerprint lines up with how the importer fingerprints chat messages.
    let senderPhone: string | undefined;
    const phoneRaw = (row.agentPhone ?? '').replace(/\s/g, '');
    if (phoneRaw && phoneRaw.toLowerCase() !== 'unknown') {
      if (phoneRaw.startsWith('0')) senderPhone = '+234' + phoneRaw.slice(1);
      else if (!phoneRaw.startsWith('+') && /^\d/.test(phoneRaw)) senderPhone = '+' + phoneRaw;
      else senderPhone = phoneRaw;
    }

    const clean = cleanBodyForParser(body);
    const fp = listingFingerprint(clean, senderPhone);

    if (canonicalFps.has(fp) || seenInThisRun.has(fp)) {
      alreadyExact++;
      continue;
    }
    if (clean.length >= DEDUP_MIN_CHARS) {
      let fuzzy = false;
      const target = normalizeForDedup(clean);
      if (target) {
        for (const prev of canonicalBodies) {
          if (prev.length < DEDUP_MIN_CHARS) continue;
          if (bodySimilarity(clean, prev) >= DEDUP_SIMILARITY) {
            fuzzy = true;
            break;
          }
        }
      }
      if (fuzzy) {
        alreadyFuzzy++;
        continue;
      }
    }

    const ts = chatTsFromTag(tagValue(row.tags, 'wa-ts:'));
    if (!ts) {
      noTimestamp++;
      continue;
    }
    const name = (row.agentName ?? '').trim() || 'unknown';
    const phoneDisplay = (row.agentPhone ?? '').trim() || 'unknown';
    const line = `[${ts}] ~ ${name} ~ (${phoneDisplay}): ${body}`;

    seenInThisRun.add(fp);
    toAppend.push(line);
    if (samples.length < 12) samples.push(`  + "${(row.title ?? '').slice(0, 60)}"`);
  }

  console.log('\nReconciliation:');
  console.log(
    JSON.stringify(
      {
        dbListings: rows.length,
        alreadyInAllChatsExact: alreadyExact,
        alreadyInAllChatsFuzzy: alreadyFuzzy,
        missingFromAllChats: toAppend.length,
        skippedNoTimestampTag: noTimestamp,
      },
      null,
      2
    )
  );
  if (samples.length) {
    console.log('\nSample missing entries (would be appended):');
    console.log(samples.join('\n'));
  }

  if (toAppend.length === 0) {
    console.log('\nAll_chats.txt already covers every imported listing. Nothing to sync.');
    await mongoose.disconnect();
    return;
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to append these to All_chats.txt.');
    await mongoose.disconnect();
    return;
  }

  const block = toAppend.join('\n');
  const current = existsSync(ALL_CHATS_PATH) ? readFileSync(ALL_CHATS_PATH, 'utf8') : '';
  const prefix = current.length === 0 || current.endsWith('\n') ? '' : '\n';
  appendFileSync(ALL_CHATS_PATH, prefix + block + '\n', 'utf8');
  console.log(`\nAppended ${toAppend.length} reconstructed messages to ${ALL_CHATS_PATH}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
