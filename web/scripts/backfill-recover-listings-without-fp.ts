/**
 * Recover WhatsApp-import listings that lack a wa-fp: tag by fuzzy-matching
 * title/location/beds against all chat export messages.
 *
 *   cd web
 *   npx tsx scripts/backfill-recover-listings-without-fp.ts            # dry-run
 *   npx tsx scripts/backfill-recover-listings-without-fp.ts --apply    # persist
 *   npx tsx scripts/backfill-recover-listings-without-fp.ts --min-score 88
 */
import dns from 'node:dns';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
  bodySimilarity,
  cleanBodyForParser,
  listingFingerprint,
  parseMessageMeta,
  splitChatMessages,
} from './lib/chat-import-utils';
import {
  ALL_CHATS_PATH,
  REPO_ROOT,
  discoverChatExportDirs,
  resolveChatExportTextPath,
} from './lib/chat-import-paths';
import { mongoUriForConnect } from './lib/mongo-uri';
import { looksLikeHumanizedListingHtml } from '../src/lib/whatsapp-description';
import { prepareWhatsAppListingDescription } from '../src/lib/whatsapp-listing-parser';
import { stripHtml } from '../src/lib/utils';

if (process.platform === 'win32') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const STOP_WORDS = new Set([
  'bed',
  'bedroom',
  'bedrooms',
  'at',
  'in',
  'for',
  'sale',
  'rent',
  'sqm',
  'the',
  'and',
  'nigeria',
]);

type ChatMessage = {
  body: string;
  clean: string;
  cleanLower: string;
  fp: string;
  senderPhone?: string;
};

type ChatIndex = {
  messages: ChatMessage[];
  byToken: Map<string, number[]>;
};

function tokenizeForIndex(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function indexChatText(raw: string, byFp: Map<string, ChatMessage>): number {
  let added = 0;
  for (const full of splitChatMessages(raw)) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    if (clean.length < 20) continue;
    const fp = listingFingerprint(clean, senderPhone);
    if (byFp.has(fp)) continue;
    byFp.set(fp, {
      body,
      clean,
      cleanLower: clean.toLowerCase(),
      fp,
      senderPhone,
    });
    added++;
  }
  return added;
}

function loadChatIndex(): ChatIndex {
  const byFp = new Map<string, ChatMessage>();

  if (existsSync(ALL_CHATS_PATH)) {
    indexChatText(readFileSync(ALL_CHATS_PATH, 'utf8'), byFp);
  }

  for (const exportDir of discoverChatExportDirs(REPO_ROOT)) {
    const textPath = resolveChatExportTextPath(exportDir);
    if (!textPath) continue;
    indexChatText(readFileSync(textPath, 'utf8'), byFp);
  }

  const messages = [...byFp.values()];
  const byToken = new Map<string, number[]>();

  for (let i = 0; i < messages.length; i++) {
    for (const token of new Set(tokenizeForIndex(messages[i]!.clean))) {
      const arr = byToken.get(token);
      if (arr) arr.push(i);
      else byToken.set(token, [i]);
    }
  }

  return { messages, byToken };
}

function candidateIndices(tokens: string[], byToken: Map<string, number[]>): number[] {
  const counts = new Map<number, number>();
  for (const token of tokens) {
    const hits = byToken.get(token);
    if (!hits) continue;
    for (const idx of hits) {
      counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
  }
  const minHits = Math.min(2, tokens.length);
  return [...counts.entries()]
    .filter(([, n]) => n >= minHits)
    .map(([idx]) => idx);
}

function parseArgs() {
  const apply = process.argv.includes('--apply');
  const minIdx = process.argv.indexOf('--min-score');
  const minScore =
    minIdx >= 0 && process.argv[minIdx + 1]
      ? Math.max(70, parseInt(process.argv[minIdx + 1]!, 10) || 85)
      : 85;
  return { apply, minScore };
}

function tagValue(tags: string[] | undefined, prefix: string): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.find((t) => typeof t === 'string' && t.startsWith(prefix));
}

function locationTokensFromTitle(title: string): string[] {
  const m = title.match(/\s+at\s+(.+)$/i);
  const loc = (m?.[1] ?? title).trim();
  return loc
    .split(/[,/]+/)
    .flatMap((part) => part.trim().split(/\s+/))
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function bedsFromTitle(title: string): number | undefined {
  const m = title.match(/(\d+)\s*bed/i);
  return m ? Number(m[1]) : undefined;
}

function areaFromTitle(title: string): number | undefined {
  const m = title.match(/(\d[\d,]*)\s*sqm/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function listingSearchText(row: {
  title?: string;
  description?: string;
  bedrooms?: number;
  area?: number;
}): string {
  const title = String(row.title ?? '').trim();
  const desc = stripHtml(String(row.description ?? '')).trim();
  const locMatch = title.match(/\s+at\s+(.+)$/i);
  const loc = locMatch?.[1] ?? '';
  const beds = row.bedrooms || bedsFromTitle(title);
  const area = row.area || areaFromTitle(title);
  const parts = [loc, title.replace(/\s+at\s+.+$/i, '').trim()];
  if (beds) parts.push(`${beds} bed`);
  if (area) parts.push(`${area} sqm`);
  if (desc && !looksLikeHumanizedListingHtml(desc) && !/listed for (?:rent|sale) on digit properties/i.test(desc)) {
    parts.push(desc.slice(0, 400));
  }
  return parts.filter(Boolean).join(' ');
}

function locationHitCount(cleanLower: string, tokens: string[]): number {
  let hits = 0;
  for (const t of tokens) {
    if (cleanLower.includes(t)) hits++;
  }
  return hits;
}

function passesBedFilter(clean: string, beds?: number): boolean {
  if (!beds || beds <= 0) return true;
  return new RegExp(`\\b${beds}\\s*(?:bed(?:room)?s?|br|bd)\\b`, 'i').test(clean);
}

function passesAreaFilter(clean: string, area?: number): boolean {
  if (!area || area <= 0) return true;
  const compact = area.toString();
  const withComma = area.toLocaleString('en-US');
  return clean.includes(compact) || clean.includes(withComma);
}

function findBestMatch(
  row: {
    title?: string;
    description?: string;
    bedrooms?: number;
    area?: number;
    agentPhone?: string;
  },
  index: ChatIndex,
  minScore: number
): { message: ChatMessage; score: number } | null {
  const tokens = locationTokensFromTitle(String(row.title ?? ''));
  if (tokens.length < 1) return null;

  const beds = row.bedrooms || bedsFromTitle(String(row.title ?? ''));
  const area = row.area || areaFromTitle(String(row.title ?? ''));
  const query = listingSearchText(row);
  const minLocHits = Math.min(2, tokens.length);
  const candidates = candidateIndices(tokens, index.byToken);

  let best: { message: ChatMessage; score: number } | null = null;
  let secondBest = 0;

  for (const idx of candidates) {
    const msg = index.messages[idx]!;
    if (locationHitCount(msg.cleanLower, tokens) < minLocHits) continue;
    if (!passesBedFilter(msg.clean, beds)) continue;
    if (!passesAreaFilter(msg.clean, area)) continue;

    let score = bodySimilarity(query, msg.clean);
    if (row.agentPhone && msg.senderPhone) {
      const a = row.agentPhone.replace(/\D/g, '').slice(-10);
      const b = msg.senderPhone.replace(/\D/g, '').slice(-10);
      if (a && b && a === b) score = Math.min(100, score + 5);
    }

    if (!best || score > best.score) {
      secondBest = best?.score ?? 0;
      best = { message: msg, score };
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (!best || best.score < minScore) return null;
  if (secondBest >= minScore - 5 && secondBest >= best.score - 3) return null;
  return best;
}

async function main() {
  const { apply, minScore } = parseArgs();

  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  console.log('Indexing chat exports…');
  const index = loadChatIndex();
  console.log(`Indexed ${index.messages.length} unique messages\n`);

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const rows = (await Listing.find({ tags: 'whatsapp-chat-import' })
    .select('_id title description tags agentPhone bedrooms area')
    .lean()) as {
    _id: { toString(): string };
    title?: string;
    description?: string;
    tags?: string[];
    agentPhone?: string;
    bedrooms?: number;
    area?: number;
  }[];

  const targets = rows.filter((r) => !tagValue(r.tags, 'wa-fp:'));
  let matched = 0;
  let updated = 0;
  let unchanged = 0;
  let noMatch = 0;

  for (const row of targets) {
    const hit = findBestMatch(row, index, minScore);
    if (!hit) {
      noMatch++;
      continue;
    }
    matched++;

    const next = prepareWhatsAppListingDescription(hit.message.body).slice(0, 5000);
    const current = (row.description ?? '').trim();
    const fpTag = `wa-fp:${hit.message.fp}`;
    const tags = [...new Set([...(row.tags ?? []).map(String), fpTag])];

    if (current === next.trim() && (row.tags ?? []).includes(fpTag)) {
      unchanged++;
      continue;
    }

    updated++;
    const preview = (row.title ?? row._id.toString()).slice(0, 55);
    console.log(`${apply ? 'update' : 'would update'}: ${preview} (score ${hit.score})`);
    console.log(`  ${hit.message.clean.slice(0, 90).replace(/\s+/g, ' ')}…`);

    if (apply) {
      await Listing.findByIdAndUpdate(row._id, {
        $set: { description: next, tags },
      });
    }
  }

  console.log(
    `\nNo wa-fp tag: ${targets.length} | matched: ${matched} | ${apply ? 'updated' : 'would update'}: ${updated} | unchanged: ${unchanged} | no match: ${noMatch} | min score: ${minScore}`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
