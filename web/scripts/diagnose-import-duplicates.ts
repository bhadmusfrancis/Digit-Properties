/**
 * Find duplicate import candidates in MARKET1 chat and/or MongoDB.
 *   npx tsx scripts/diagnose-import-duplicates.ts
 *   npx tsx scripts/diagnose-import-duplicates.ts --mongo
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
  splitChatMessages,
  parseMessageMeta,
  cleanBodyForParser,
  extractAttachmentFilenames,
  listingFingerprint,
  hasResolvableMedia,
  looksLikeListingFromClean,
  bodySimilarity,
  DEDUP_MIN_CHARS,
  DEDUP_SIMILARITY,
} from './lib/chat-import-utils';

const REPO = path.resolve(process.cwd(), '..');
const MARKET1 = path.join(REPO, 'WhatsApp Chat - WORLD MARKET1');
const EMAIL = 'fabhainternation@gmail.com';

type Candidate = {
  index: number;
  fp: string;
  clean: string;
  title: string;
  files: string[];
  senderPhone?: string;
};

async function loadChatCandidates() {
  const { parseWhatsAppListingText } = await import('../src/lib/whatsapp-listing-parser');
  const raw = readFileSync(path.join(MARKET1, 'chat.txt'), 'utf8');
  const out: Candidate[] = [];
  splitChatMessages(raw).forEach((full, index) => {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    const files = extractAttachmentFilenames(full);
    if (!hasResolvableMedia(files, MARKET1)) return;
    const one = parseWhatsAppListingText(clean);
    if (!looksLikeListingFromClean(clean, one)) return;
    out.push({
      index,
      fp: listingFingerprint(clean, senderPhone),
      clean,
      title: one.parsed.title.slice(0, 80),
      files,
      senderPhone,
    });
  });
  return out;
}

function analyzeChat(candidates: Candidate[]) {
  const byFp = new Map<string, Candidate[]>();
  const byFile = new Map<string, Candidate[]>();

  for (const c of candidates) {
    const list = byFp.get(c.fp) ?? [];
    list.push(c);
    byFp.set(c.fp, list);
    for (const f of c.files) {
      const fl = byFile.get(f) ?? [];
      fl.push(c);
      byFile.set(f, fl);
    }
  }

  const fpDupes = [...byFp.entries()].filter(([, list]) => list.length > 1);
  const fileDupes = [...byFile.entries()].filter(([, list]) => list.length > 1);

  const fuzzyPairs: { a: Candidate; b: Candidate; score: number }[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (a.fp === b.fp) continue;
      if (a.clean.length < DEDUP_MIN_CHARS || b.clean.length < DEDUP_MIN_CHARS) continue;
      const score = bodySimilarity(a.clean, b.clean);
      if (score >= DEDUP_SIMILARITY) fuzzyPairs.push({ a, b, score });
    }
  }

  console.log('\n=== chat.txt analysis ===');
  console.log(`Listing candidates (with media): ${candidates.length}`);
  console.log(`Unique wa-fp fingerprints: ${byFp.size}`);
  console.log(`Same fingerprint (exact duplicate messages): ${fpDupes.length} groups`);
  for (const [fp, list] of fpDupes.slice(0, 10)) {
    console.log(`  fp ${fp.slice(0, 12)}… ×${list.length}: ${list.map((x) => x.title).join(' | ')}`);
  }
  console.log(`Same attachment file on multiple candidates: ${fileDupes.length} files`);
  for (const [file, list] of fileDupes.slice(0, 15)) {
    console.log(`  ${file} → ${list.length} msgs: ${list.map((x) => x.title.slice(0, 40)).join('; ')}`);
  }
  console.log(`Fuzzy duplicate pairs (≥${DEDUP_SIMILARITY}% text, different fp): ${fuzzyPairs.length}`);
  for (const { a, b, score } of fuzzyPairs.slice(0, 15)) {
    console.log(`  ${score}%: "${a.title}" ↔ "${b.title}"`);
    console.log(`    files: ${a.files[0] ?? '?'} vs ${b.files[0] ?? '?'}`);
  }

  const byTitle = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = c.title.toLowerCase();
    const list = byTitle.get(key) ?? [];
    list.push(c);
    byTitle.set(key, list);
  }
  const titleCollisions = [...byTitle.entries()].filter(([, list]) => list.length > 1);
  console.log(
    `Same parsed title, different messages (not DB dupes — generic titles): ${titleCollisions.length} titles`
  );
  for (const [title, list] of titleCollisions.sort((a, b) => b[1].length - a[1].length).slice(0, 8)) {
    console.log(`  "${title}" ×${list.length} — attachments: ${list.map((x) => x.files[0] ?? '?').join(', ')}`);
  }
}

async function analyzeMongo(candidates: Candidate[]) {
  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const User = (await import('../src/models/User')).default;

  await mongoose.connect(process.env.MONGODB_URI!);
  const author = await User.findOne({ email: EMAIL.toLowerCase() }).lean();

  const rows = (await Listing.find(
    author ? { createdBy: author._id, tags: 'whatsapp-chat-import' } : { tags: 'whatsapp-chat-import' }
  )
    .select('_id title tags images videos createdAt')
    .lean()) as {
    _id: { toString(): string };
    title?: string;
    tags?: string[];
    images?: { public_id?: string }[];
    videos?: { public_id?: string }[];
    createdAt?: Date;
  }[];

  const fpBuckets = new Map<string, typeof rows>();
  const chatFpSet = new Set(candidates.map((c) => c.fp));

  for (const row of rows) {
    const fpTag = row.tags?.find((t) => t.startsWith('wa-fp:'));
    const fp = fpTag?.slice(7);
    if (!fp) continue;
    const list = fpBuckets.get(fp) ?? [];
    list.push(row);
    fpBuckets.set(fp, list);
  }

  const dbFpDupes = [...fpBuckets.entries()].filter(([, list]) => list.length > 1);
  const inChatNotInDb = candidates.filter((c) => !fpBuckets.has(c.fp));

  console.log('\n=== MongoDB (whatsapp-chat-import) ===');
  console.log(`Listings with wa-fp tag: ${fpBuckets.size} unique fingerprints, ${rows.length} total rows`);
  console.log(`Duplicate wa-fp in DB (same message imported twice): ${dbFpDupes.length} groups`);
  for (const [fp, list] of dbFpDupes.slice(0, 20)) {
    console.log(`  fp ${fp.slice(0, 12)}… ×${list.length}:`);
    for (const r of list) {
      console.log(`    ${r._id} "${(r.title ?? '').slice(0, 55)}" ${r.createdAt?.toISOString?.() ?? ''}`);
    }
  }
  console.log(`In chat, not yet in DB: ${inChatNotInDb.length}`);

  await mongoose.disconnect();
}

async function main() {
  const useMongo = process.argv.includes('--mongo');
  const candidates = await loadChatCandidates();
  analyzeChat(candidates);
  if (useMongo) {
    try {
      await analyzeMongo(candidates);
    } catch (e) {
      console.error('\nMongo analysis failed:', e);
    }
  } else {
    console.log('\nTip: npx tsx scripts/diagnose-import-duplicates.ts --mongo');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
