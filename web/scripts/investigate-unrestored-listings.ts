/**
 * Diagnose whatsapp-chat-import listings that backfill-whatsapp-description-format cannot restore.
 *
 *   cd web
 *   npx tsx scripts/investigate-unrestored-listings.ts
 */
import dns from 'node:dns';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
  splitChatMessages,
  parseMessageMeta,
  cleanBodyForParser,
  listingFingerprint,
  normalizeForDedup,
} from './lib/chat-import-utils';
import { ALL_CHATS_PATH } from './lib/chat-import-paths';
import { mongoUriForConnect } from './lib/mongo-uri';
import { stripHtml } from '../src/lib/utils';

if (process.platform === 'win32') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const HUMANIZED_MARKERS = [
  /listed for rent on digit properties/i,
  /listed for sale on digit properties/i,
  /we recommend a physical inspection/i,
  /digit properties connects you/i,
  /may suit buyers or tenants/i,
  /summarised the listing in plain language/i,
];

function tagValue(tags: string[] | undefined, prefix: string): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.find((t) => typeof t === 'string' && t.startsWith(prefix));
}

function looksHumanized(description: string): boolean {
  const plain = stripHtml(description);
  return HUMANIZED_MARKERS.some((re) => re.test(plain));
}

function fpBase(fp: string): string {
  const idx = fp.lastIndexOf('-');
  if (idx <= 0) return fp;
  const suffix = fp.slice(idx + 1);
  if (/^\d+$/.test(suffix)) return fp.slice(0, idx);
  return fp;
}

async function main() {
  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const canonicalRaw = existsSync(ALL_CHATS_PATH)
    ? readFileSync(ALL_CHATS_PATH, 'utf8')
    : '';
  const byFp = new Map<string, string>();
  const byNormalized = new Map<string, string[]>();

  if (canonicalRaw) {
    for (const full of splitChatMessages(canonicalRaw)) {
      const { body, senderPhone } = parseMessageMeta(full);
      const clean = cleanBodyForParser(body);
      if (clean.length < 15) continue;
      const fp = listingFingerprint(clean, senderPhone);
      byFp.set(fp, body);
      const norm = normalizeForDedup(clean);
      const arr = byNormalized.get(norm) ?? [];
      arr.push(fp);
      byNormalized.set(norm, arr);
    }
  }

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const rows = (await Listing.find({ tags: 'whatsapp-chat-import' })
    .select('_id title description tags agentPhone createdAt updatedAt status')
    .lean()) as {
    _id: { toString(): string };
    title?: string;
    description?: string;
    tags?: string[];
    agentPhone?: string;
    createdAt?: Date;
    updatedAt?: Date;
    status?: string;
  }[];

  type Bucket = 'missing_fp_tag' | 'fp_not_in_archive' | 'fp_suffix_not_in_archive' | 'restorable';
  const buckets: Record<Bucket, typeof rows> = {
    missing_fp_tag: [],
    fp_not_in_archive: [],
    fp_suffix_not_in_archive: [],
    restorable: [],
  };

  for (const row of rows) {
    const fpTag = tagValue(row.tags, 'wa-fp:');
    if (!fpTag) {
      buckets.missing_fp_tag.push(row);
      continue;
    }
    const fp = fpTag.slice('wa-fp:'.length);
    if (byFp.has(fp)) {
      buckets.restorable.push(row);
      continue;
    }
    const base = fpBase(fp);
    if (base !== fp && byFp.has(base)) {
      buckets.fp_suffix_not_in_archive.push(row);
      continue;
    }
    buckets.fp_not_in_archive.push(row);
  }

  const unrestored = [
    ...buckets.missing_fp_tag,
    ...buckets.fp_not_in_archive,
    ...buckets.fp_suffix_not_in_archive,
  ];

  console.log('=== Unrestored listing investigation ===\n');
  console.log(`All_chats.txt indexed fingerprints: ${byFp.size}`);
  console.log(`Total whatsapp-chat-import listings: ${rows.length}`);
  console.log(`Restorable (fp in archive): ${buckets.restorable.length}`);
  console.log(`Unrestored total: ${unrestored.length}\n`);

  console.log('Breakdown:');
  console.log(`  missing wa-fp: tag: ${buckets.missing_fp_tag.length}`);
  console.log(`  wa-fp not in All_chats.txt: ${buckets.fp_not_in_archive.length}`);
  console.log(`  wa-fp suffix variant (base exists): ${buckets.fp_suffix_not_in_archive.length}`);

  const humanized = unrestored.filter((r) => looksHumanized(String(r.description ?? '')));
  console.log(`\nUnrestored with humanized HTML description: ${humanized.length}`);

  const statusCounts = new Map<string, number>();
  for (const r of unrestored) {
    const s = String(r.status ?? 'unknown');
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
  }
  console.log('\nStatus of unrestored listings:');
  for (const [s, n] of [...statusCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${n}`);
  }

  const tagExtras = new Map<string, number>();
  for (const r of unrestored) {
    for (const t of r.tags ?? []) {
      if (t === 'whatsapp-chat-import' || t === 'whatsapp-import' || t.startsWith('wa-fp:')) continue;
      tagExtras.set(t, (tagExtras.get(t) ?? 0) + 1);
    }
  }
  if (tagExtras.size) {
    console.log('\nOther tags on unrestored listings (top 15):');
    for (const [t, n] of [...tagExtras.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${t}: ${n}`);
    }
  }

  console.log('\n--- Sample: missing wa-fp: tag (up to 8) ---');
  for (const r of buckets.missing_fp_tag.slice(0, 8)) {
    const descLen = stripHtml(String(r.description ?? '')).length;
    console.log(`  ${r.title?.slice(0, 55)} | desc ${descLen} chars | humanized=${looksHumanized(String(r.description ?? ''))}`);
    console.log(`    tags: ${(r.tags ?? []).slice(0, 6).join(', ')}`);
  }

  console.log('\n--- Sample: fp not in archive (up to 8) ---');
  for (const r of buckets.fp_not_in_archive.slice(0, 8)) {
    const fp = tagValue(r.tags, 'wa-fp:')!.slice('wa-fp:'.length);
    const descLen = stripHtml(String(r.description ?? '')).length;
    console.log(`  ${r.title?.slice(0, 55)} | fp=${fp.slice(0, 12)}… | desc ${descLen} chars`);
    console.log(`    humanized=${looksHumanized(String(r.description ?? ''))} | agent=${r.agentPhone ?? 'n/a'}`);
  }

  if (buckets.fp_suffix_not_in_archive.length) {
    console.log('\n--- Sample: suffix fp (base in archive) ---');
    for (const r of buckets.fp_suffix_not_in_archive.slice(0, 5)) {
      const fp = tagValue(r.tags, 'wa-fp:')!.slice('wa-fp:'.length);
      console.log(`  ${r.title?.slice(0, 55)} | fp=${fp} | base=${fpBase(fp).slice(0, 12)}…`);
    }
  }

  // Try matching unrestored descriptions to archive by normalized body text
  let normMatch = 0;
  let normAmbiguous = 0;
  for (const r of buckets.fp_not_in_archive) {
    const plain = stripHtml(String(r.description ?? '')).trim();
    if (plain.length < 40) continue;
    const norm = normalizeForDedup(plain);
    const hits = byNormalized.get(norm);
    if (!hits?.length) continue;
    if (hits.length === 1) normMatch++;
    else normAmbiguous++;
  }
  console.log(`\nText-normalization rescue candidates (fp not in archive):`);
  console.log(`  unique norm match in archive: ${normMatch}`);
  console.log(`  ambiguous norm matches: ${normAmbiguous}`);

  // Check if missing-fp listings share import batch tags
  const importBatchTags = new Map<string, number>();
  for (const r of buckets.missing_fp_tag) {
    for (const t of r.tags ?? []) {
      if (t.startsWith('wa-') || t.startsWith('import-')) {
        importBatchTags.set(t, (importBatchTags.get(t) ?? 0) + 1);
      }
    }
  }
  if (importBatchTags.size) {
    console.log('\nImport-related tags on missing-fp listings:');
    for (const [t, n] of [...importBatchTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  ${t}: ${n}`);
    }
  }

  // Created date distribution for unrestored
  const byMonth = new Map<string, number>();
  for (const r of unrestored) {
    const d = r.createdAt ? new Date(r.createdAt) : null;
    const key = d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` : 'unknown';
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  console.log('\nUnrestored by created month:');
  for (const [m, n] of [...byMonth.entries()].sort()) {
    console.log(`  ${m}: ${n}`);
  }

  // chat-source tag breakdown for fp-not-in-archive bucket
  const sourceCounts = new Map<string, number>();
  for (const r of buckets.fp_not_in_archive) {
    const src =
      tagValue(r.tags, 'chat-source:')?.slice('chat-source:'.length) ?? '(no chat-source tag)';
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
  }
  if (sourceCounts.size) {
    console.log('\nchat-source tags (fp not in All_chats.txt):');
    for (const [s, n] of [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${s}: ${n}`);
    }
  }

  // Try locating missing fps in per-group chat exports (only folders referenced above)
  const { REPO_ROOT } = await import('./lib/chat-import-paths');
  const { readdirSync } = await import('fs');
  const chatDirs = readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.toLowerCase().includes('whatsapp chat'))
    .map((d) => d.name);

  function sourceSlugToDir(slug: string): string | undefined {
    const target = slug.toLowerCase();
    return chatDirs.find((d) => {
      const s = d
        .replace(/^WhatsApp Chat\s*-\s*/i, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return s === target;
    });
  }

  function indexChatDir(dirName: string): Set<string> {
    const fps = new Set<string>();
    for (const fname of ['chat.txt', '_chat.txt'] as const) {
      const filePath = path.join(REPO_ROOT, dirName, fname);
      if (!existsSync(filePath)) continue;
      const raw = readFileSync(filePath, 'utf8');
      for (const full of splitChatMessages(raw)) {
        const { body, senderPhone } = parseMessageMeta(full);
        const clean = cleanBodyForParser(body);
        if (clean.length < 15) continue;
        fps.add(listingFingerprint(clean, senderPhone));
      }
    }
    return fps;
  }

  const dirCache = new Map<string, Set<string>>();
  let foundInExport = 0;
  let noChatSource = 0;
  const exportHitsBySource = new Map<string, number>();

  for (const r of buckets.fp_not_in_archive) {
    const fp = tagValue(r.tags, 'wa-fp:')!.slice('wa-fp:'.length);
    const slug = tagValue(r.tags, 'chat-source:')?.slice('chat-source:'.length);
    if (!slug) {
      noChatSource++;
      continue;
    }
    const dir = sourceSlugToDir(slug);
    if (!dir) continue;
    if (!dirCache.has(dir)) dirCache.set(dir, indexChatDir(dir));
    if (dirCache.get(dir)!.has(fp)) {
      foundInExport++;
      exportHitsBySource.set(slug, (exportHitsBySource.get(slug) ?? 0) + 1);
    }
  }

  console.log('\nSource export lookup (fp not in All_chats.txt):');
  console.log(`  found in group chat.txt/_chat.txt: ${foundInExport}/${buckets.fp_not_in_archive.length}`);
  console.log(`  no chat-source tag: ${noChatSource}`);
  if (exportHitsBySource.size) {
    console.log('  recoverable by source export:');
    for (const [s, n] of [...exportHitsBySource.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${s}: ${n}`);
    }
  }

  // missing-fp bucket: do descriptions still look like original paste?
  let missingFpOriginalPaste = 0;
  let missingFpHumanized = 0;
  for (const r of buckets.missing_fp_tag) {
    if (looksHumanized(String(r.description ?? ''))) missingFpHumanized++;
    else missingFpOriginalPaste++;
  }
  console.log('\nmissing wa-fp: tag breakdown:');
  console.log(`  still original paste text: ${missingFpOriginalPaste}`);
  console.log(`  humanized HTML: ${missingFpHumanized}`);
  console.log(`  no wa-ts / wa-fp / chat-source tags: ${buckets.missing_fp_tag.filter((r) => !(r.tags ?? []).some((t) => t.startsWith('wa-') || t.startsWith('chat-source:'))).length}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
