/**
 * List MARKET1 candidates not yet in DB and why media may fail.
 *   npx tsx scripts/diagnose-market1-remaining.ts
 */
import { existsSync, statSync } from 'fs';
import path from 'path';
import { existsSync as envExists } from 'fs';

const REPO = path.resolve(process.cwd(), '..');
const MARKET1 = path.join(REPO, 'WhatsApp Chat - WORLD MARKET1');
const MARKET1_CHAT = path.join(MARKET1, 'chat.txt');

async function main() {
  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (envExists(envPath)) config({ path: envPath });

  const {
    splitChatMessages,
    parseMessageMeta,
    cleanBodyForParser,
    extractAttachmentFilenames,
    listingFingerprint,
    hasResolvableMedia,
    looksLikeListingFromClean,
    MEDIA_EXT,
  } = await import('./lib/chat-import-utils');
  const { readFileSync } = await import('fs');
  const { parseWhatsAppListingText } = await import('../src/lib/whatsapp-listing-parser');

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const User = (await import('../src/models/User')).default;

  const email = 'fabhainternation@gmail.com';
  await mongoose.connect(process.env.MONGODB_URI!);
  const author = await User.findOne({ email }).lean();
  const dbFps = new Set<string>();
  if (author) {
    const rows = await Listing.find({ createdBy: author._id, tags: 'whatsapp-chat-import' })
      .select('tags title')
      .lean();
    for (const row of rows) {
      for (const t of (row as { tags?: string[] }).tags ?? []) {
        if (t.startsWith('wa-fp:')) dbFps.add(t.slice(7));
      }
    }
  }
  await mongoose.disconnect();

  const raw = readFileSync(MARKET1_CHAT, 'utf8');
  const messages = splitChatMessages(raw);

  console.log(`DB wa-fp count: ${dbFps.size}\n`);

  for (const full of messages) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    const files = extractAttachmentFilenames(body);
    if (!hasResolvableMedia(files, MARKET1)) continue;
    const one = parseWhatsAppListingText(clean);
    if (!looksLikeListingFromClean(clean, one)) continue;
    const fp = listingFingerprint(clean, senderPhone);
    if (dbFps.has(fp)) continue;

    console.log('--- NOT IN DB ---');
    console.log('Title:', one.parsed.title.slice(0, 80));
    console.log('FP:', fp);
    console.log('Price:', one.parsed.price);
    for (const fname of files) {
      const ext = path.extname(fname).toLowerCase();
      const kind = MEDIA_EXT[ext];
      const local = path.join(MARKET1, fname);
      if (!kind) {
        console.log(`  ${fname}: unsupported ext`);
        continue;
      }
      if (!existsSync(local)) {
        console.log(`  ${fname}: MISSING on disk`);
        continue;
      }
      const mb = statSync(local).size / (1024 * 1024);
      if (kind === 'video' && mb > 40) {
        console.log(`  ${fname}: video too large (${mb.toFixed(1)} MB)`);
      } else {
        console.log(`  ${fname}: ok ${kind} ${mb.toFixed(2)} MB`);
      }
    }
    console.log('');
  }
}

main().catch(console.error);
