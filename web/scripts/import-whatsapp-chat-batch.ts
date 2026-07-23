/**
 * Import a WhatsApp export folder into listings.
 *
 * Protocol:
 * 0. Dedupe repo-root All_chats.txt (remove duplicate fingerprints before import)
 * 1. Build chat.txt from _chat.txt using repo-root All_contacts.txt
 * 2. Dedupe against All_chats.txt + MongoDB (before any Cloudinary upload)
 * 3. Import real-estate listings (media optional; neighbouring same-contact media/text merged)
 *    - Require a price on every listing
 *    - Rewrite descriptions under 250 chars; keep originals in All_chats.txt + originalDescription
 * 4. Append original messages to All_chats.txt after successful imports
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
  buildAuthorImportDedupeIndex,
  createChatImportDedupeState,
  shouldSkipChatImportBeforeUpload,
  markChatImportAccepted,
  dedupeAllChatsArchive,
  type ChatImportDedupeState,
} from './lib/chat-import-utils';
import { stripContactPhonesFromText } from '../src/lib/whatsapp-listing-parser';
import { ALL_CHATS_PATH, ALL_CONTACTS_PATH, resolveSourceDir, slugFromChatDir } from './lib/chat-import-paths';
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
  console.log(`All contacts: ${ALL_CONTACTS_PATH}`);
  console.log(`Batch tag: ${batchTag}`);

  console.log('\nStep 0: Dedupe All_chats.txt before import…');
  const allChatsDedupe = dedupeAllChatsArchive();
  console.log(JSON.stringify(allChatsDedupe, null, 2));

  if (!existsSync(path.join(sourceDir, '_chat.txt'))) {
    console.error(`Missing ${path.join(sourceDir, '_chat.txt')}`);
    process.exit(1);
  }
  if (!existsSync(ALL_CONTACTS_PATH)) {
    console.error(`Missing ${ALL_CONTACTS_PATH} (merge contacts.txt files into All_contacts.txt first)`);
    process.exit(1);
  }

  if (!skipBuild) {
    console.log('\nStep 1: Build chat.txt (real-estate filter, All_contacts.txt)…');
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
  let skippedNotListing = 0;
  let skippedNoPrice = 0;
  const mediaMergePreview = buildMediaMergeMap(allSource, parseWhatsAppListingText);

  for (const msg of allSource) {
    const one = parseWhatsAppListingText(msg.clean);
    if (!looksLikeListingFromClean(msg.clean, one)) {
      skippedNotListing++;
      continue;
    }
    if (one.parsed.price <= 0) {
      skippedNoPrice++;
      continue;
    }
    candidates.push(msg);
  }

  const mongoUri = mongoUriForConnect(process.env.MONGODB_URI || '');

  let dedupeState: ChatImportDedupeState | null = null;
  if (mongoUri) {
    const mongoose = (await import('mongoose')).default;
    const Listing = (await import('../src/models/Listing')).default;
    const User = (await import('../src/models/User')).default;
    await mongoose.connect(mongoUri);
    const author = await User.findOne({ email: authorEmail.toLowerCase().trim() }).select('_id').lean();
    if (author) {
      const authorIndex = await buildAuthorImportDedupeIndex(author._id, Listing);
      dedupeState = createChatImportDedupeState(canonicalFps, canonicalBodies, authorIndex);
      console.log(`Existing DB fingerprints (wa-fp): ${authorIndex.dbFps.size}`);
    }
    await mongoose.disconnect();
  }

  const newMessages: ParsedChatMessage[] = [];
  let skippedAlreadyInDb = 0;
  let skippedSimilarDup = 0;
  for (const msg of candidates) {
    const one = parseWhatsAppListingText(msg.clean);
    if (!one.parsed.agentPhone && msg.senderPhone) one.parsed.agentPhone = msg.senderPhone;
    const mergedFiles = [
      ...new Set([...(msg.files ?? []), ...(mediaMergePreview.get(msg.index) ?? [])]),
    ];
    if (dedupeState) {
      const dup = shouldSkipChatImportBeforeUpload(
        {
          clean: msg.clean,
          senderPhone: msg.senderPhone,
          title: one.parsed.title,
          description: one.parsed.description,
          location: one.parsed.location,
          attachmentFilenames: mergedFiles,
        },
        dedupeState
      );
      if (dup.skip) {
        if (dup.reason.includes('fingerprint') || dup.reason.includes('All_chats')) {
          skippedAlreadyInDb++;
        } else {
          skippedSimilarDup++;
        }
        continue;
      }
    } else {
      const fp = listingFingerprint(msg.clean, msg.senderPhone);
      if (canonicalFps.has(fp)) {
        skippedAlreadyInDb++;
        continue;
      }
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

  console.log('\nStep 2: Filter (real-estate + price + dedupe before upload; media optional)');
  console.log(
    JSON.stringify(
      {
        sourceMessages: allSource.length,
        candidates: candidates.length,
        toImport: newMessages.length,
        eligibleForAllChatsIfAllSucceed: toAppend.length,
        skippedNoPrice,
        skippedNotListing,
        skippedAlreadyInDb,
        skippedSimilarDup,
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
  const needsCloudinary = newMessages.some((msg) => {
    const merged = [
      ...new Set([...(msg.files ?? []), ...(mediaMergePreview.get(msg.index) ?? [])]),
    ];
    return hasResolvableMedia(merged, sourceDir);
  });
  if (
    !dryRun &&
    needsCloudinary &&
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
  const { prepareListingFieldsForSeo } = await import('../src/lib/listing-seo-prep');
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

  if (!dedupeState && author) {
    const authorIndex = await buildAuthorImportDedupeIndex(author._id, Listing);
    dedupeState = createChatImportDedupeState(canonicalFps, canonicalBodies, authorIndex);
  }

  const uploadCache = new Map<string, { url: string; public_id: string; kind: 'image' | 'video' }>();

  let created = 0;
  let skipped = 0;
  let duplicates = 0;
  let uploadErrors = 0;
  /** Only messages that resulted in a new listing (or dry-run create) are archived. */
  const messagesCreated: ParsedChatMessage[] = [];

  const logSkip = (reason: string, titleHint: string) => {
    skipped++;
    console.warn(`  skip: ${titleHint.slice(0, 55)} — ${reason}`);
  };

  console.log('\nStep 3: Import new listings to database…');

  const appendMessageToAllChats = (full: string) => {
    if (dryRun) return;
    const current = existsSync(ALL_CHATS_PATH) ? readFileSync(ALL_CHATS_PATH, 'utf8') : '';
    appendFileSync(
      ALL_CHATS_PATH,
      (current.endsWith('\n') || !current ? '' : '\n') + full.trimEnd() + '\n',
      'utf8'
    );
  };

  for (let mi = 0; mi < newMessages.length; mi++) {
    const msg = newMessages[mi];
    try {
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

    // Merge neighbouring same-contact media-only posts (indexed against full source).
    const mergedFiles = [
      ...new Set([...(msg.files ?? []), ...(mediaMergePreview.get(msg.index) ?? [])]),
    ];
    const hasMedia = hasResolvableMedia(mergedFiles, sourceDir);

    const { parsed, confidence, missing } = one;
    if (!parsed.agentName && msg.senderName) parsed.agentName = msg.senderName;
    let description = stripContactPhonesFromText(parsed.description);
    if (description.length < 20) description = `${description}\n\n(Imported from WhatsApp chat.)`.slice(0, 5000);
    if (description.length > 5000) description = description.slice(0, 5000);

    if (parsed.price <= 0) {
      logSkip('price missing or zero', parsed.title || titleHint);
      continue;
    }

    let fp: string;
    if (dedupeState) {
      const dup = shouldSkipChatImportBeforeUpload(
        {
          clean,
          senderPhone: msg.senderPhone,
          title: parsed.title,
          description,
          location: parsed.location,
          attachmentFilenames: mergedFiles,
        },
        dedupeState
      );
      if (dup.skip) {
        duplicates++;
        console.warn(`  duplicate: ${(parsed.title || titleHint).slice(0, 55)} — ${dup.reason}`);
        continue;
      }
      fp = dup.fp;
    } else {
      fp = listingFingerprint(clean, msg.senderPhone);
    }

    const fpTag = `wa-fp:${fp}`;
    const tsTag = tsTagFromDate(msg.sentAt);
    const tags = [
      ...new Set([
        ...(parsed.tags || []),
        'whatsapp-import',
        'whatsapp-chat-import',
        batchTag,
        fpTag,
        ...(hasMedia ? [] : ['wa-no-media']),
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
      contactSource: 'author' as const,
      status: 'active' as const,
      images: [] as { url: string; public_id: string }[],
      videos: [] as { url: string; public_id: string }[],
    };

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
        `[dry-run] create: "${validated.data.title.slice(0, 55)}..." | ${confidence} | ${mergedFiles.length} file(s)${hasMedia ? '' : ' | no-media'}`
      );
      created++;
      messagesCreated.push(msg);
      if (dedupeState) markChatImportAccepted(dedupeState, fp, clean, mergedFiles);
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

    if (hasMedia && images.length === 0 && videos.length === 0) {
      console.warn(
        `  media upload failed for all files (${mergedFiles.join(', ') || 'none'}); creating listing without media`
      );
    }

    const hadUploadedMedia = images.length > 0 || videos.length > 0;
    const tagsWithMedia = hadUploadedMedia
      ? (validated.data.tags ?? []).filter((t) => t !== 'wa-no-media')
      : [...new Set([...(validated.data.tags ?? []), 'wa-no-media'])];

    const payloadWithMedia = {
      ...validated.data,
      images,
      videos,
      tags: tagsWithMedia,
      contactSource: payload.contactSource,
    };

    const seoCreate = prepareListingFieldsForSeo({
      title: payloadWithMedia.title,
      description: payloadWithMedia.description,
      price: payloadWithMedia.price,
      listingType: payloadWithMedia.listingType,
      rentPeriod: payloadWithMedia.rentPeriod,
      propertyType: payloadWithMedia.propertyType,
      propertyTypes: payloadWithMedia.propertyTypes,
      location: payloadWithMedia.location,
      images: payloadWithMedia.images,
      videos: payloadWithMedia.videos,
      tags: payloadWithMedia.tags,
      bedrooms: payloadWithMedia.bedrooms,
      bathrooms: payloadWithMedia.bathrooms,
      toilets: payloadWithMedia.toilets,
      area: payloadWithMedia.area,
      amenities: payloadWithMedia.amenities,
    });
    await Listing.create({
      ...payloadWithMedia,
      description: seoCreate.description,
      ...(seoCreate.originalDescription
        ? { originalDescription: seoCreate.originalDescription }
        : {}),
      images: seoCreate.images,
      videos: seoCreate.videos.length ? seoCreate.videos : [],
      tags: seoCreate.tags,
      slug: await ensureUniqueListingSlug({
        title: payloadWithMedia.title,
        location: payloadWithMedia.location,
      }),
      createdBy: author!._id,
      createdByType: 'user',
      viewCount: 0,
    });
    created++;
    messagesCreated.push(msg);
    appendMessageToAllChats(msg.full);
    if (dedupeState) markChatImportAccepted(dedupeState, fp, clean, mergedFiles);
    console.log(
      `  ok: "${payloadWithMedia.title.slice(0, 55)}..." (${missing.length ? `missing ${missing.length}` : 'ok'}${seoCreate.originalDescription ? '; rewritten' : ''}${hadUploadedMedia ? '' : '; no-media'}) [${created}/${newMessages.length}]`
    );
    } catch (err) {
      skipped++;
      console.error(
        `  error on message ${mi + 1}/${newMessages.length}:`,
        err instanceof Error ? err.message : err
      );
      if (!dryRun && mongoose.connection.readyState !== 1) {
        console.warn('  Mongo disconnected — reconnecting…');
        try {
          await mongoose.connect(mongoUri);
        } catch (re) {
          console.error('  reconnect failed:', re instanceof Error ? re.message : re);
          break;
        }
      }
    }
  }

  if (!dryRun) await mongoose.disconnect();

  console.log('\nImport summary:', { created, duplicates, skipped, uploadErrors });

  console.log('\nStep 4: All_chats.txt already appended per successful create.');
  if (dryRun) {
    console.log(
      `[dry-run] Would append ${messagesCreated.length} messages to All_chats.txt (${toAppend.length} eligible if all imports succeed)`
    );
  } else if (messagesCreated.length === 0) {
    console.log('No listings created; nothing appended to All_chats.txt.');
  } else {
    console.log(`Archived ${messagesCreated.length} messages during import.`);
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
