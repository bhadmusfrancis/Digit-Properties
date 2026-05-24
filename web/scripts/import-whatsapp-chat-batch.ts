/**
 * Import a WhatsApp export folder into listings.
 *
 * Protocol:
 * 1. Build chat.txt from _chat.txt (contacts.txt in the SAME folder only)
 * 2. Dedupe against repo-root All_chats.txt (all groups)
 * 3. Import listings with media + real-estate filter
 * 4. Append new messages to All_chats.txt after successful imports
 * 5. Dedupe listings in MongoDB
 *
 *   cd web
 *   npx tsx scripts/import-whatsapp-chat-batch.ts --source-dir "WhatsApp Chat - NIGERIA MARKET"
 *   npx tsx scripts/import-whatsapp-chat-batch.ts --source-dir "WhatsApp Chat - NIGERIA MARKET" --dry-run
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import path from 'path';

import {
  MEDIA_EXT,
  ParsedChatMessage,
  cleanBodyForParser,
  extractAttachmentFilenames,
  uploadListingMediaToCloudinary,
  hasResolvableMedia,
  isDuplicateOfCanonical,
  listingFingerprint,
  looksLikeListingFromClean,
  parseMessageMeta,
  splitChatMessages,
  tsTagFromDate,
} from './lib/chat-import-utils';
import { ALL_CHATS_PATH, resolveSourceDir, slugFromChatDir } from './lib/chat-import-paths';
import { mongoUriForConnect } from './lib/mongo-uri';

const AUTHOR_EMAIL_DEFAULT = 'fabhainternation@gmail.com';
const BUILD_CHAT_PY = path.join(process.cwd(), 'scripts', 'build_chat_export.py');

function parseArgs() {
  const argv = process.argv.slice(2);
  let dryRun = false;
  let skipBuild = false;
  let email = AUTHOR_EMAIL_DEFAULT;
  let sourceDir = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--skip-build') skipBuild = true;
    else if (a === '--email' && argv[i + 1]) email = argv[++i];
    else if (a === '--source-dir' && argv[i + 1]) sourceDir = argv[++i];
  }
  if (!sourceDir) {
    console.error('Usage: npx tsx scripts/import-whatsapp-chat-batch.ts --source-dir "<folder>" [--dry-run] [--skip-build]');
    process.exit(1);
  }
  return { dryRun, skipBuild, email, sourceDir };
}

function buildCanonicalIndex(canonicalRaw: string): { fps: Set<string>; bodies: string[] } {
  const fps = new Set<string>();
  const bodies: string[] = [];
  for (const full of splitChatMessages(canonicalRaw)) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    if (clean.length >= 15) {
      fps.add(listingFingerprint(clean, senderPhone));
      bodies.push(clean);
    }
  }
  return { fps, bodies };
}

function parseMessagesFromRaw(raw: string): ParsedChatMessage[] {
  return splitChatMessages(raw).map((full, index) => {
    const { body, senderName, senderPhone, sentAt } = parseMessageMeta(full);
    return {
      index,
      full,
      body,
      clean: cleanBodyForParser(body),
      senderName,
      senderPhone,
      files: extractAttachmentFilenames(full),
      sentAt,
    };
  });
}

function buildMediaMergeMap(
  messages: ParsedChatMessage[],
  parseWhatsAppListingText: (t: string) => unknown
) {
  const mediaMergeMap = new Map<number, string[]>();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m.files.length) continue;
    const probe = m.clean.length > 0 ? parseWhatsAppListingText(m.clean) : null;
    const looksLike = probe
      ? looksLikeListingFromClean(m.clean, probe as { parsed: { price: number; bedrooms: number; area?: number } })
      : false;
    if (looksLike) continue;
    for (const c of [i - 1, i + 1]) {
      const near = messages[c];
      if (!near) continue;
      if ((near.senderPhone ?? '') !== (m.senderPhone ?? '')) continue;
      const nearProbe = near.clean.length > 0 ? parseWhatsAppListingText(near.clean) : null;
      const nearLooksLike = nearProbe
        ? looksLikeListingFromClean(
            near.clean,
            nearProbe as { parsed: { price: number; bedrooms: number; area?: number } }
          )
        : false;
      if (!nearLooksLike) continue;
      const prev = mediaMergeMap.get(c) ?? [];
      mediaMergeMap.set(c, [...new Set([...prev, ...m.files])]);
      break;
    }
  }
  return mediaMergeMap;
}

async function runDedupe(apply: boolean) {
  const { spawnSync } = await import('child_process');
  const args = ['tsx', 'scripts/dedupe-all-listings.ts'];
  if (apply) args.push('--apply');
  const r = spawnSync('npx', args, { cwd: process.cwd(), stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error('dedupe-all-listings failed');
}

async function main() {
  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  const { dryRun, skipBuild, email: authorEmail, sourceDir: sourceDirArg } = parseArgs();
  const sourceDir = resolveSourceDir(sourceDirArg);
  const sourceChat = path.join(sourceDir, 'chat.txt');
  const sourceSlug = slugFromChatDir(path.basename(sourceDir));
  const batchTag = `chat-source:${sourceSlug}`;

  console.log(`Source: ${sourceDir}`);
  console.log(`All chats: ${ALL_CHATS_PATH}`);
  console.log(`Batch tag: ${batchTag}`);

  if (!existsSync(path.join(sourceDir, '_chat.txt'))) {
    console.error(`Missing ${path.join(sourceDir, '_chat.txt')}`);
    process.exit(1);
  }
  if (!existsSync(path.join(sourceDir, 'contacts.txt'))) {
    console.error(`Missing ${path.join(sourceDir, 'contacts.txt')} (must be in the same folder as _chat.txt)`);
    process.exit(1);
  }

  if (!skipBuild) {
    console.log('\nStep 1: Build chat.txt (real-estate filter, local contacts.txt)…');
    try {
      execSync(`python "${BUILD_CHAT_PY}" --dir "${sourceDir}"`, {
        stdio: 'inherit',
        encoding: 'utf8',
      });
    } catch (e) {
      console.error('build_chat_export.py failed. Ensure Python 3 and rapidfuzz are installed.');
      throw e;
    }
  } else {
    console.log('\nStep 1: Skipped build (--skip-build)');
  }

  if (!existsSync(sourceChat)) {
    console.error(`Expected ${sourceChat} after build`);
    process.exit(1);
  }

  const canonicalRaw = existsSync(ALL_CHATS_PATH) ? readFileSync(ALL_CHATS_PATH, 'utf8') : '';
  const sourceRaw = readFileSync(sourceChat, 'utf8');
  const { fps: canonicalFps, bodies: canonicalBodies } = buildCanonicalIndex(canonicalRaw);

  const allSource = parseMessagesFromRaw(sourceRaw);
  const { parseWhatsAppListingText } = await import('../src/lib/whatsapp-listing-parser');

  const candidates: ParsedChatMessage[] = [];
  let skippedNoMedia = 0;
  let skippedNotListing = 0;
  const mediaMergePreview = buildMediaMergeMap(allSource, parseWhatsAppListingText);

  for (const msg of allSource) {
    const previewFiles = [
      ...new Set([...(msg.files ?? []), ...(mediaMergePreview.get(msg.index) ?? [])]),
    ];
    if (!hasResolvableMedia(previewFiles, sourceDir)) {
      skippedNoMedia++;
      continue;
    }
    const one = parseWhatsAppListingText(msg.clean);
    if (!looksLikeListingFromClean(msg.clean, one)) {
      skippedNotListing++;
      continue;
    }
    candidates.push(msg);
  }

  const mongoUri = mongoUriForConnect(process.env.MONGODB_URI || '');

  let dbFps = new Set<string>();
  if (!dryRun && mongoUri) {
    const mongoose = (await import('mongoose')).default;
    const Listing = (await import('../src/models/Listing')).default;
    const User = (await import('../src/models/User')).default;
    await mongoose.connect(mongoUri);
    const author = await User.findOne({ email: authorEmail.toLowerCase().trim() }).select('_id').lean();
    if (author) {
      const rows = await Listing.find({
        createdBy: author._id,
        tags: 'whatsapp-chat-import',
      })
        .select('tags')
        .lean();
      for (const row of rows) {
        const tags = Array.isArray((row as { tags?: string[] }).tags) ? (row as { tags: string[] }).tags : [];
        for (const t of tags) {
          if (t.startsWith('wa-fp:')) dbFps.add(t.slice('wa-fp:'.length));
        }
      }
    }
    await mongoose.disconnect();
    console.log(`Existing DB fingerprints (wa-fp): ${dbFps.size}`);
  }

  const newMessages: ParsedChatMessage[] = [];
  let skippedAlreadyInDb = 0;
  for (const msg of candidates) {
    const fp = listingFingerprint(msg.clean, msg.senderPhone);
    if (dbFps.has(fp)) {
      skippedAlreadyInDb++;
      continue;
    }
    newMessages.push(msg);
  }

  const toAppend = newMessages.filter(
    (msg) =>
      !isDuplicateOfCanonical(
        msg.clean,
        msg.senderPhone,
        listingFingerprint(msg.clean, msg.senderPhone),
        canonicalFps,
        canonicalBodies
      )
  );

  console.log('\nStep 2: Filter (media + real-estate + not in DB + not in All_chats.txt)');
  console.log(
    JSON.stringify(
      {
        sourceMessages: allSource.length,
        candidatesWithMedia: candidates.length,
        toImport: newMessages.length,
        toAppendToAllChats: toAppend.length,
        skippedNoMedia,
        skippedNotListing,
        skippedAlreadyInDb,
      },
      null,
      2
    )
  );

  if (newMessages.length === 0) {
    console.log('No new listings to import.');
    return;
  }

  if (!process.env.MONGODB_URI && !dryRun) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  if (
    !dryRun &&
    (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET)
  ) {
    console.error('Cloudinary env vars missing');
    process.exit(1);
  }

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const User = (await import('../src/models/User')).default;
  const { listingSchema } = await import('../src/lib/validations');
  const { ensureUniqueListingSlug } = await import('../src/lib/listing-slug');
  const cloudinary = (await import('cloudinary')).v2;
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  if (!dryRun) await mongoose.connect(mongoUri);

  const author = dryRun
    ? null
    : await User.findOne({ email: authorEmail.toLowerCase().trim() }).lean();
  if (!dryRun && !author) {
    console.error(`User not found: ${authorEmail}`);
    process.exit(1);
  }

  const mediaMergeMap = buildMediaMergeMap(newMessages, parseWhatsAppListingText);
  const uploadCache = new Map<string, { url: string; public_id: string; kind: 'image' | 'video' }>();

  let created = 0;
  let skipped = 0;
  let duplicates = 0;
  let uploadErrors = 0;

  const logSkip = (reason: string, titleHint: string) => {
    skipped++;
    console.warn(`  skip: ${titleHint.slice(0, 55)} — ${reason}`);
  };

  console.log('\nStep 3: Import new listings to database…');

  for (let mi = 0; mi < newMessages.length; mi++) {
    const msg = newMessages[mi];
    const clean = msg.clean;
    const titleHint = clean.slice(0, 60) || msg.full.slice(0, 60);
    if (clean.length < 15) {
      logSkip('body too short', titleHint);
      continue;
    }

    const one = parseWhatsAppListingText(clean);
    if (!one.parsed.agentPhone && msg.senderPhone) one.parsed.agentPhone = msg.senderPhone;
    if (!looksLikeListingFromClean(clean, one)) {
      logSkip('not a property listing', titleHint);
      continue;
    }

    const mergedFiles = [...new Set([...(msg.files ?? []), ...(mediaMergeMap.get(mi) ?? [])])];
    if (!hasResolvableMedia(mergedFiles, sourceDir)) {
      logSkip('no resolvable media on disk', titleHint);
      continue;
    }

    const images: { url: string; public_id: string }[] = [];
    const videos: { url: string; public_id: string }[] = [];

    for (const fname of mergedFiles) {
      const ext = path.extname(fname).toLowerCase();
      const kind = MEDIA_EXT[ext];
      if (!kind) continue;
      const localPath = path.join(sourceDir, fname);
      if (!existsSync(localPath)) continue;
      const { statSync } = await import('fs');
      if (kind === 'video' && statSync(localPath).size / (1024 * 1024) > 40) continue;

      const cacheKey = path.resolve(localPath);
      if (uploadCache.has(cacheKey)) {
        const c = uploadCache.get(cacheKey)!;
        if (c.kind === 'image') images.push({ url: c.url, public_id: c.public_id });
        else videos.push({ url: c.url, public_id: c.public_id });
        continue;
      }
      if (dryRun) {
        const fake = { url: `dry-run://${fname}`, public_id: `dry/${fname}`, kind };
        uploadCache.set(cacheKey, fake);
        if (kind === 'image') images.push({ url: fake.url, public_id: fake.public_id });
        else videos.push({ url: fake.url, public_id: fake.public_id });
        continue;
      }
      try {
        const up = await uploadListingMediaToCloudinary(cloudinary, localPath, kind);
        uploadCache.set(cacheKey, { ...up, kind });
        if (kind === 'image') images.push(up);
        else videos.push(up);
      } catch (e) {
        uploadErrors++;
        console.error(`  upload failed ${fname}:`, e);
      }
    }

    if (images.length === 0 && videos.length === 0) {
      logSkip(`no media uploaded (${mergedFiles.join(', ') || 'none'})`, one.parsed.title || titleHint);
      continue;
    }

    const { parsed, confidence, missing } = one;
    if (!parsed.agentName && msg.senderName) parsed.agentName = msg.senderName;
    let description = parsed.description;
    if (description.length < 20) description = `${description}\n\n(Imported from WhatsApp chat.)`.slice(0, 5000);
    if (description.length > 5000) description = description.slice(0, 5000);

    const fp = listingFingerprint(clean, msg.senderPhone);
    const fpTag = `wa-fp:${fp}`;
    const tsTag = tsTagFromDate(msg.sentAt);
    const tags = [
      ...new Set([
        ...(parsed.tags || []),
        'whatsapp-import',
        'whatsapp-chat-import',
        batchTag,
        fpTag,
        ...(tsTag ? [tsTag] : []),
      ]),
    ];

    const payload = {
      title: parsed.title.slice(0, 200),
      description,
      listingType: parsed.listingType,
      propertyType: parsed.propertyType,
      price: parsed.price,
      location: parsed.location,
      bedrooms: parsed.bedrooms,
      bathrooms: parsed.bathrooms,
      toilets: parsed.toilets ?? 0,
      area: parsed.area,
      amenities: parsed.amenities?.length ? parsed.amenities : [],
      tags,
      agentName: parsed.agentName,
      agentPhone: parsed.agentPhone,
      agentEmail: parsed.agentEmail,
      rentPeriod: parsed.rentPeriod,
      status: 'active' as const,
      images,
      videos,
    };

    if (payload.price <= 0) {
      logSkip('price missing or zero', payload.title);
      continue;
    }
    if (payload.listingType === 'rent' && !payload.rentPeriod) {
      payload.rentPeriod = 'year';
    }

    const validated = listingSchema.safeParse(payload);
    if (!validated.success) {
      const issues = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      logSkip(`validation failed (${issues})`, payload.title);
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] create: "${validated.data.title.slice(0, 55)}..." | ${confidence} | ${images.length}i ${videos.length}v`
      );
      created++;
      continue;
    }

    const existing = await Listing.findOne({ createdBy: author!._id, tags: fpTag }).select('_id').lean();
    if (existing) {
      duplicates++;
      continue;
    }

    await Listing.create({
      ...validated.data,
      images: validated.data.images ?? [],
      videos: validated.data.videos?.length ? validated.data.videos : [],
      slug: await ensureUniqueListingSlug({
        title: validated.data.title,
        location: validated.data.location,
      }),
      createdBy: author!._id,
      createdByType: 'user',
      viewCount: 0,
    });
    created++;
    console.log(`  ok: "${validated.data.title.slice(0, 55)}..." (${missing.length ? `missing ${missing.length}` : 'ok'})`);
  }

  if (!dryRun) await mongoose.disconnect();

  console.log('\nImport summary:', { created, duplicates, skipped, uploadErrors });

  console.log('\nStep 4: Append new messages to All_chats.txt…');
  if (!dryRun && toAppend.length > 0) {
    const appendBlock = toAppend.map((m) => m.full).join('\n');
    const current = existsSync(ALL_CHATS_PATH) ? readFileSync(ALL_CHATS_PATH, 'utf8') : '';
    appendFileSync(ALL_CHATS_PATH, (current.endsWith('\n') || !current ? '' : '\n') + appendBlock + '\n', 'utf8');
    console.log(`Appended ${toAppend.length} messages to ${ALL_CHATS_PATH}`);
  } else if (dryRun) {
    console.log(`[dry-run] Would append ${toAppend.length} messages to All_chats.txt`);
  } else {
    console.log('All_chats.txt already contains these messages; nothing to append.');
  }

  console.log('\nStep 5: Remove duplicate listings in database…');
  if (!dryRun) await runDedupe(true);
  else console.log('[dry-run] Would run dedupe-all-listings.ts --apply');

  console.log('\nBatch complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
