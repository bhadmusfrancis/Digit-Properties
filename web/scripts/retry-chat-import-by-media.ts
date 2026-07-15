/**
 * Retry import for chat messages matching specific attachment filenames.
 *
 *   npx tsx scripts/retry-chat-import-by-media.ts \
 *     --source-dir "../WhatsApp Chat - NIGERIA MARKET6" \
 *     --files "00001040-VIDEO-2026-06-01-07-54-59.mp4,00001041-VIDEO-2026-06-01-07-55-00.mp4"
 */
import { existsSync, readFileSync, appendFileSync } from 'fs';
import path from 'path';

import {
  cleanBodyForParser,
  extractAttachmentFilenames,
  uploadListingMediaToCloudinary,
  hasResolvableMedia,
  looksLikeListingFromClean,
  parseMessageMeta,
  splitChatMessages,
  tsTagFromDate,
  MEDIA_EXT,
  buildAuthorImportDedupeIndex,
  createChatImportDedupeState,
  shouldSkipChatImportBeforeUpload,
  markChatImportAccepted,
  listingFingerprint,
} from './lib/chat-import-utils';
import { ALL_CHATS_PATH, resolveSourceDir, slugFromChatDir } from './lib/chat-import-paths';
import { mongoUriForConnect } from './lib/mongo-uri';

const AUTHOR_EMAIL_DEFAULT = 'fabhainternation@gmail.com';

function parseArgs() {
  const argv = process.argv.slice(2);
  let sourceDir = '';
  let email = AUTHOR_EMAIL_DEFAULT;
  let files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source-dir' && argv[i + 1]) sourceDir = argv[++i];
    else if (a === '--email' && argv[i + 1]) email = argv[++i];
    else if (a === '--files' && argv[i + 1]) {
      files = argv[++i].split(',').map((f) => f.trim()).filter(Boolean);
    }
  }
  if (!sourceDir || files.length === 0) {
    console.error('Usage: --source-dir "<folder>" --files "file1.mp4,file2.mp4"');
    process.exit(1);
  }
  return { sourceDir, email, files };
}

async function main() {
  const { config } = await import('dotenv');
  config({ path: path.resolve(process.cwd(), '.env.local') });

  const { sourceDir: sourceDirArg, email: authorEmail, files: targetFiles } = parseArgs();
  const sourceDir = resolveSourceDir(sourceDirArg);
  const sourceChat = path.join(sourceDir, 'chat.txt');
  const sourceSlug = slugFromChatDir(path.basename(sourceDir));
  const batchTag = `chat-source:${sourceSlug}`;
  const targetSet = new Set(targetFiles);

  if (!existsSync(sourceChat)) {
    console.error(`Missing ${sourceChat}`);
    process.exit(1);
  }

  const raw = readFileSync(sourceChat, 'utf8');
  const messages = splitChatMessages(raw)
    .map((full, index) => {
      const { body, senderName, senderPhone, sentAt } = parseMessageMeta(full);
      const attachmentFiles = extractAttachmentFilenames(full);
      return {
        index,
        full,
        body,
        clean: cleanBodyForParser(body),
        senderName,
        senderPhone,
        files: attachmentFiles,
        sentAt,
      };
    })
    .filter((m) => m.files.some((f) => targetSet.has(f)));

  if (messages.length === 0) {
    console.error('No messages matched the given attachment filenames.');
    process.exit(1);
  }

  console.log(`Retrying ${messages.length} message(s) from ${sourceDir}`);

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const User = (await import('../src/models/User')).default;
  const { listingSchema } = await import('../src/lib/validations');
  const { parseWhatsAppListingText } = await import('../src/lib/whatsapp-listing-parser');
  const { ensureUniqueListingSlug } = await import('../src/lib/listing-slug');
  const { prepareListingFieldsForSeo } = await import('../src/lib/listing-seo-prep');
  const cloudinary = (await import('cloudinary')).v2;
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const mongoUri = mongoUriForConnect(process.env.MONGODB_URI || '');
  if (!mongoUri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  const author = await User.findOne({ email: authorEmail.toLowerCase().trim() }).lean();
  if (!author) {
    console.error(`User not found: ${authorEmail}`);
    process.exit(1);
  }

  const authorIndex = await buildAuthorImportDedupeIndex(author._id, Listing);
  const canonicalRaw = existsSync(ALL_CHATS_PATH) ? readFileSync(ALL_CHATS_PATH, 'utf8') : '';
  const canonicalFps = new Set<string>();
  const canonicalBodies: string[] = [];
  for (const full of splitChatMessages(canonicalRaw)) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    if (clean.length >= 15) {
      canonicalFps.add(listingFingerprint(clean, senderPhone));
      canonicalBodies.push(clean);
    }
  }
  const dedupeState = createChatImportDedupeState(canonicalFps, canonicalBodies, authorIndex);

  let created = 0;
  const appended: string[] = [];

  for (const msg of messages) {
    const titleHint = msg.clean.slice(0, 60) || msg.full.slice(0, 60);
    const one = parseWhatsAppListingText(msg.clean);
    if (!one.parsed.agentPhone && msg.senderPhone) one.parsed.agentPhone = msg.senderPhone;
    if (!looksLikeListingFromClean(msg.clean, one)) {
      console.warn(`  skip: not a listing — ${titleHint}`);
      continue;
    }

    const mergedFiles = msg.files.filter((f) => targetSet.has(f));
    if (!hasResolvableMedia(mergedFiles, sourceDir)) {
      console.warn(`  skip: media missing on disk — ${titleHint}`);
      continue;
    }

    const { parsed, missing } = one;
    if (!parsed.agentName && msg.senderName) parsed.agentName = msg.senderName;
    let description = parsed.description;
    if (description.length < 20) description = `${description}\n\n(Imported from WhatsApp chat.)`.slice(0, 5000);

    const dup = shouldSkipChatImportBeforeUpload(
      {
        clean: msg.clean,
        senderPhone: msg.senderPhone,
        title: parsed.title,
        description,
        location: parsed.location,
        attachmentFilenames: mergedFiles,
      },
      dedupeState
    );
    if (dup.skip) {
      console.log(`  already imported: "${parsed.title.slice(0, 55)}..." — ${dup.reason}`);
      continue;
    }
    const fp = dup.fp;

    if (parsed.price <= 0) {
      console.warn(`  skip: price missing — ${parsed.title}`);
      continue;
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
        ...(tsTag ? [tsTag] : []),
      ]),
    ];

    const payload = {
      title: parsed.title.slice(0, 200),
      description: description.slice(0, 5000),
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
      images: [] as { url: string; public_id: string }[],
      videos: [] as { url: string; public_id: string }[],
    };

    if (payload.listingType === 'rent' && !payload.rentPeriod) payload.rentPeriod = 'year';

    const validated = listingSchema.safeParse(payload);
    if (!validated.success) {
      console.warn(`  skip: validation — ${payload.title}`);
      continue;
    }

    const images: { url: string; public_id: string }[] = [];
    const videos: { url: string; public_id: string }[] = [];
    for (const fname of mergedFiles) {
      const ext = path.extname(fname).toLowerCase();
      const kind = MEDIA_EXT[ext];
      if (!kind) continue;
      const localPath = path.join(sourceDir, fname);
      try {
        const up = await uploadListingMediaToCloudinary(cloudinary, localPath, kind);
        if (kind === 'image') images.push(up);
        else videos.push(up);
      } catch (e) {
        console.error(`  upload failed ${fname}:`, e);
      }
    }

    if (images.length === 0 && videos.length === 0) {
      console.warn(`  skip: upload failed — ${parsed.title || titleHint}`);
      continue;
    }

    const payloadWithMedia = { ...validated.data, images, videos };

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
      createdBy: author._id,
      createdByType: 'user',
      viewCount: 0,
    });
    created++;
    markChatImportAccepted(dedupeState, fp, msg.clean, mergedFiles);
    appended.push(msg.full);
    console.log(`  ok: "${payloadWithMedia.title.slice(0, 55)}..." (${missing.length ? `missing ${missing.length}` : 'ok'})`);
  }

  await mongoose.disconnect();

  if (appended.length > 0) {
    const current = existsSync(ALL_CHATS_PATH) ? readFileSync(ALL_CHATS_PATH, 'utf8') : '';
    appendFileSync(
      ALL_CHATS_PATH,
      (current.endsWith('\n') || !current ? '' : '\n') + appended.join('\n') + '\n',
      'utf8'
    );
    console.log(`Appended ${appended.length} message(s) to All_chats.txt`);
  }

  console.log(`Done. Created ${created} listing(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
