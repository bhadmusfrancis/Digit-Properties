/**
 * Restore WhatsApp line breaks and markup in imported listing descriptions
 * from All_chats.txt and every `_chat.txt` export under the repo (via sibling chat.txt).
 *
 *   cd web
 *   npx tsx scripts/backfill-whatsapp-description-format.ts            # dry-run
 *   npx tsx scripts/backfill-whatsapp-description-format.ts --apply    # persist
 */
import dns from 'node:dns';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import {
  splitChatMessages,
  parseMessageMeta,
  cleanBodyForParser,
  listingFingerprint,
} from './lib/chat-import-utils';
import {
  ALL_CHATS_PATH,
  REPO_ROOT,
  chatExportLabel,
  discoverChatExportDirs,
  resolveChatExportTextPath,
} from './lib/chat-import-paths';
import { mongoUriForConnect } from './lib/mongo-uri';
import { prepareWhatsAppListingDescription } from '../src/lib/whatsapp-listing-parser';

if (process.platform === 'win32') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const BUILD_CHAT_PY = path.join(process.cwd(), 'scripts', 'build_chat_export.py');

function parseArgs() {
  const apply = process.argv.includes('--apply');
  const skipBuild = process.argv.includes('--skip-build');
  return { apply, skipBuild };
}

function tagValue(tags: string[] | undefined, prefix: string): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.find((t) => typeof t === 'string' && t.startsWith(prefix));
}

function fpBase(fp: string): string {
  const idx = fp.lastIndexOf('-');
  if (idx <= 0) return fp;
  const suffix = fp.slice(idx + 1);
  if (/^\d+$/.test(suffix)) return fp.slice(0, idx);
  return fp;
}

function indexChatText(raw: string, byFp: Map<string, string>): number {
  let added = 0;
  for (const full of splitChatMessages(raw)) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    if (clean.length < 15) continue;
    const fp = listingFingerprint(clean, senderPhone);
    if (!byFp.has(fp)) {
      byFp.set(fp, body);
      added++;
    }
  }
  return added;
}

function ensureBuiltChat(exportDir: string, skipBuild: boolean): void {
  const chatPath = path.join(exportDir, 'chat.txt');
  const rawPath = path.join(exportDir, '_chat.txt');
  const contactsPath = path.join(exportDir, 'contacts.txt');

  if (!existsSync(rawPath) || !existsSync(contactsPath)) return;
  if (skipBuild && existsSync(chatPath)) return;

  const needsBuild =
    !existsSync(chatPath) ||
    statSafe(rawPath)! > statSafe(chatPath)!;

  if (!needsBuild && skipBuild) return;

  try {
    execSync(`python "${BUILD_CHAT_PY}" --dir "${exportDir}" --all`, {
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`  warn: could not build chat.txt for ${chatExportLabel(exportDir)}: ${msg.slice(0, 120)}`);
  }
}

function statSafe(p: string): number | null {
  try {
    return existsSync(p) ? statSync(p).mtimeMs : null;
  } catch {
    return null;
  }
}

function lookupBody(byFp: Map<string, string>, fp: string): string | undefined {
  return byFp.get(fp) ?? byFp.get(fpBase(fp));
}

async function main() {
  const { apply, skipBuild } = parseArgs();

  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const byFp = new Map<string, string>();

  if (existsSync(ALL_CHATS_PATH)) {
    const n = indexChatText(readFileSync(ALL_CHATS_PATH, 'utf8'), byFp);
    console.log(`Indexed All_chats.txt (+${n} unique fingerprints, total ${byFp.size})`);
  } else {
    console.warn(`All_chats.txt not found at ${ALL_CHATS_PATH}`);
  }

  const exportDirs = discoverChatExportDirs(REPO_ROOT);
  console.log(`Found ${exportDirs.length} _chat.txt export folders under ${REPO_ROOT}`);

  for (const exportDir of exportDirs) {
    ensureBuiltChat(exportDir, skipBuild);
    const textPath = resolveChatExportTextPath(exportDir);
    if (!textPath) continue;
    const before = byFp.size;
    indexChatText(readFileSync(textPath, 'utf8'), byFp);
    const label = chatExportLabel(exportDir);
    console.log(`  ${label}: +${byFp.size - before} (total ${byFp.size})`);
  }

  console.log(`Combined unique fingerprints: ${byFp.size}`);

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
  let noFpTag = 0;
  let noSource = 0;

  for (const row of rows) {
    const fp = tagValue(row.tags, 'wa-fp:')?.slice('wa-fp:'.length);
    if (!fp) {
      noFpTag++;
      continue;
    }
    const body = lookupBody(byFp, fp);
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
    `\nListings: ${rows.length} | matched source: ${matched} | ${apply ? 'updated' : 'would update'}: ${updated} | unchanged: ${unchanged} | no wa-fp tag: ${noFpTag} | fp not in exports: ${noSource}`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
