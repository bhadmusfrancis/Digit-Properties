/**
 * Import WORLD MARKET1 WhatsApp export:
 * 1. Build chat.txt from _chat.txt (real-estate filter via build_chat.py)
 * 2. Compare with canonical WORLD MARKET/chat.txt — drop duplicates
 * 3. Append only new messages to canonical chat.txt
 * 4. Import new listings (media required, real-estate only) to MongoDB
 * 5. Run global listing dedupe
 *
 *   cd web
 *   npx tsx scripts/import-world-market1-batch.ts
 *   npx tsx scripts/import-world-market1-batch.ts --dry-run
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import path from 'path';

import {
  MEDIA_EXT,
  ParsedChatMessage,
  cleanBodyForParser,
  extractAttachmentFilenames,
  hasResolvableMedia,
  isDuplicateOfCanonical,
  listingFingerprint,
  looksLikeListingFromClean,
  normalizeForDedup,
  parseMessageMeta,
  splitChatMessages,
  tsTagFromDate,
} from './lib/chat-import-utils';

const AUTHOR_EMAIL_DEFAULT = 'fabhainternation@gmail.com';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const MARKET1_DIR = path.join(REPO_ROOT, 'WhatsApp Chat - WORLD MARKET1');
const MARKET_DIR = path.join(REPO_ROOT, 'WhatsApp Chat - WORLD MARKET');
const MARKET1_CHAT = path.join(MARKET1_DIR, 'chat.txt');
const CANONICAL_CHAT = path.join(MARKET_DIR, 'chat.txt');
const BUILD_CHAT_PY = path.join(MARKET1_DIR, 'build_chat.py');

function parseArgs() {
  const argv = process.argv.slice(2);
  let dryRun = false;
  let skipBuild = false;
  let email = AUTHOR_EMAIL_DEFAULT;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--skip-build') skipBuild = true;
    else if (argv[i] === '--email' && argv[i + 1]) email = argv[++i];
  }
  return { dryRun, skipBuild, email };
}

function buildCanonicalIndex(canonicalRaw: string): {
  fps: Set<string>;
  bodies: string[];
} {
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
      files: extractAttachmentFilenames(body),
      sentAt,
    };
  });
}

function buildMediaMergeMap(messages: ParsedChatMessage[], parseWhatsAppListingText: (t: string) => unknown) {
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

async function uploadFileToCloudinary(
  cloudinary: typeof import('cloudinary').v2,
  filePath: string,
  kind: 'image' | 'video'
): Promise<{ url: string; public_id: string }> {
  const buffer = readFileSync(filePath);
  const resource_type = kind === 'video' ? 'video' : 'image';
  const opts: {
    folder: string;
    resource_type: 'image' | 'video';
    transformation?: Array<{ width: number; crop: string; quality: string }>;
  } = { folder: 'listings', resource_type };
  if (kind === 'image') {
    opts.transformation = [{ width: 1920, crop: 'limit', quality: 'auto' }];
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Upload timeout for ${path.basename(filePath)}`));
    }, 120000);
    const stream = cloudinary.uploader.upload_stream(opts, (err, res) => {
      clearTimeout(timer);
      if (err) reject(err);
      else if (res?.secure_url && res.public_id) {
        resolve({ url: res.secure_url, public_id: res.public_id });
      } else reject(new Error('Upload failed'));
    });
    stream.end(buffer);
  });
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

  const { dryRun, skipBuild, email: authorEmail } = parseArgs();

  if (!existsSync(path.join(MARKET1_DIR, '_chat.txt'))) {
    console.error(`Missing ${path.join(MARKET1_DIR, '_chat.txt')}`);
    process.exit(1);
  }
  if (!existsSync(CANONICAL_CHAT)) {
    console.error(`Missing canonical chat: ${CANONICAL_CHAT}`);
    process.exit(1);
  }

  if (!skipBuild) {
    console.log('Step 1: Build MARKET1/chat.txt (real-estate filter)…');
    try {
      execSync(`python "${BUILD_CHAT_PY}"`, {
        cwd: MARKET1_DIR,
        stdio: 'inherit',
        encoding: 'utf8',
      });
    } catch (e) {
      console.error('build_chat.py failed. Ensure Python 3 and rapidfuzz are installed.');
      throw e;
    }
  } else {
    console.log('Step 1: Skipped build (--skip-build)');
  }

  if (!existsSync(MARKET1_CHAT)) {
    console.error(`Expected ${MARKET1_CHAT} after build`);
    process.exit(1);
  }

  const canonicalRaw = readFileSync(CANONICAL_CHAT, 'utf8');
  const market1Raw = readFileSync(MARKET1_CHAT, 'utf8');
  const { fps: canonicalFps, bodies: canonicalBodies } = buildCanonicalIndex(canonicalRaw);

  const allMarket1 = parseMessagesFromRaw(market1Raw);
  const { parseWhatsAppListingText } = await import('../src/lib/whatsapp-listing-parser');

  const candidates: ParsedChatMessage[] = [];
  let skippedNoMedia = 0;
  let skippedNotListing = 0;

  for (const msg of allMarket1) {
    if (!hasResolvableMedia(msg.files, MARKET1_DIR)) {
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

  let dbFps = new Set<string>();
  if (!dryRun) {
    const mongoose = (await import('mongoose')).default;
    const Listing = (await import('../src/models/Listing')).default;
    const User = (await import('../src/models/User')).default;
    await mongoose.connect(process.env.MONGODB_URI!);
    const author = await User.findOne({ email: authorEmail.toLowerCase().trim() })
      .select('_id')
      .lean();
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

  console.log('\nStep 2: Filter (media + real-estate + not already in DB)');
  console.log(
    JSON.stringify(
      {
        market1Messages: allMarket1.length,
        candidatesWithMedia: candidates.length,
        toImport: newMessages.length,
        toAppendToCanonical: toAppend.length,
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
  const cloudinary = (await import('cloudinary')).v2;
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  if (!dryRun) await mongoose.connect(process.env.MONGODB_URI!);

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

  console.log('\nStep 4: Import new listings to database…');

  for (let mi = 0; mi < newMessages.length; mi++) {
    const msg = newMessages[mi];
    const clean = msg.clean;
    if (clean.length < 15) {
      skipped++;
      continue;
    }

    const one = parseWhatsAppListingText(clean);
    if (!one.parsed.agentPhone && msg.senderPhone) one.parsed.agentPhone = msg.senderPhone;
    if (!looksLikeListingFromClean(clean, one)) {
      skipped++;
      continue;
    }

    const mergedFiles = [...new Set([...(msg.files ?? []), ...(mediaMergeMap.get(mi) ?? [])])];
    if (!hasResolvableMedia(mergedFiles, MARKET1_DIR)) {
      skipped++;
      continue;
    }

    const images: { url: string; public_id: string }[] = [];
    const videos: { url: string; public_id: string }[] = [];

    for (const fname of mergedFiles) {
      const ext = path.extname(fname).toLowerCase();
      const kind = MEDIA_EXT[ext];
      if (!kind) continue;
      const localPath = path.join(MARKET1_DIR, fname);
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
        const up = await uploadFileToCloudinary(cloudinary, localPath, kind);
        uploadCache.set(cacheKey, { ...up, kind });
        if (kind === 'image') images.push(up);
        else videos.push(up);
      } catch (e) {
        uploadErrors++;
        console.error(`  upload failed ${fname}:`, e);
      }
    }

    if (images.length === 0 && videos.length === 0) {
      skipped++;
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
        'world-market1-batch',
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
      skipped++;
      continue;
    }

    const validated = listingSchema.safeParse(payload);
    if (!validated.success) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] create: "${validated.data.title.slice(0, 55)}..." | ${confidence} | media ${images.length}i ${videos.length}v`
      );
      created++;
      continue;
    }

    const existing = await Listing.findOne({
      createdBy: author!._id,
      tags: fpTag,
    })
      .select('_id')
      .lean();

    if (existing) {
      duplicates++;
      continue;
    }

    await Listing.create({
      ...validated.data,
      images: validated.data.images ?? [],
      videos: validated.data.videos?.length ? validated.data.videos : [],
      createdBy: author!._id,
      createdByType: 'user',
      viewCount: 0,
    });
    created++;
    console.log(`  ok: "${validated.data.title.slice(0, 55)}..." (${missing.length ? `missing ${missing.length}` : 'ok'})`);
  }

  if (!dryRun) await mongoose.disconnect();

  console.log('\nImport summary:', { created, duplicates, skipped, uploadErrors });

  console.log('\nStep 5: Append new messages to canonical chat.txt…');
  if (!dryRun && toAppend.length > 0) {
    const appendBlock = toAppend.map((m) => m.full).join('\n');
    const currentCanonical = readFileSync(CANONICAL_CHAT, 'utf8');
    appendFileSync(
      CANONICAL_CHAT,
      (currentCanonical.endsWith('\n') ? '' : '\n') + appendBlock + '\n',
      'utf8'
    );
    console.log(`Appended ${toAppend.length} messages to ${CANONICAL_CHAT}`);
  } else if (dryRun) {
    console.log(`[dry-run] Would append ${toAppend.length} messages after import`);
  } else {
    console.log('Canonical chat.txt already has these messages; nothing to append.');
  }

  console.log('\nStep 6: Remove duplicate listings in database…');
  if (!dryRun) {
    await runDedupe(true);
  } else {
    console.log('[dry-run] Would run dedupe-all-listings.ts --apply');
  }

  console.log('\nBatch complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
