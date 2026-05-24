/**
 * Import any MARKET1 listing candidates still missing from DB (by wa-fp).
 *   npx tsx scripts/import-market1-remaining.ts
 */
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import {
  splitChatMessages,
  parseMessageMeta,
  extractAttachmentFilenames,
  cleanBodyForParser,
  listingFingerprint,
  hasResolvableMedia,
  looksLikeListingFromClean,
  uploadListingMediaToCloudinary,
  isDuplicateOfCanonical,
  MEDIA_EXT,
  tsTagFromDate,
} from './lib/chat-import-utils';
import { ALL_CHATS_PATH } from './lib/chat-import-paths';

const REPO = path.resolve(process.cwd(), '..');
const MARKET1 = path.join(REPO, 'WhatsApp Chat - WORLD MARKET1');
const CANONICAL_CHAT = ALL_CHATS_PATH;
const EMAIL = 'fabhainternation@gmail.com';

function loadChatDedupIndex(chatPath: string): { fps: Set<string>; bodies: string[] } {
  const fps = new Set<string>();
  const bodies: string[] = [];
  if (!existsSync(chatPath)) return { fps, bodies };
  const raw = readFileSync(chatPath, 'utf8');
  for (const full of splitChatMessages(raw)) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    if (clean.length >= 15) {
      fps.add(listingFingerprint(clean, senderPhone));
      bodies.push(clean);
    }
  }
  return { fps, bodies };
}

function buildMediaMergeMap(
  messages: { index: number; clean: string; files: string[]; senderPhone?: string }[],
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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  const { parseWhatsAppListingText } = await import('../src/lib/whatsapp-listing-parser');
  const { listingSchema } = await import('../src/lib/validations');
  const { ensureUniqueListingSlug } = await import('../src/lib/listing-slug');
  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const User = (await import('../src/models/User')).default;
  const cloudinary = (await import('cloudinary')).v2;
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const raw = readFileSync(path.join(MARKET1, 'chat.txt'), 'utf8');
  const all = splitChatMessages(raw).map((full, index) => {
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

  const mergeMap = buildMediaMergeMap(all, parseWhatsAppListingText);

  if (!dryRun) await mongoose.connect(process.env.MONGODB_URI!);
  const author = dryRun ? null : await User.findOne({ email: EMAIL.toLowerCase() }).lean();
  if (!dryRun && !author) {
    console.error('Author not found');
    process.exit(1);
  }

  const dbFps = new Set<string>();
  const usedAttachments = new Set<string>();
  const knownBodies: string[] = [];
  if (!dryRun && author) {
    const rows = await Listing.find({ createdBy: author._id, tags: 'whatsapp-chat-import' })
      .select('tags description')
      .lean();
    for (const row of rows) {
      const r = row as { tags?: string[]; description?: string };
      for (const t of r.tags ?? []) {
        if (t.startsWith('wa-fp:')) dbFps.add(t.slice(7));
        if (t.startsWith('wa-att:')) usedAttachments.add(t.slice(7));
      }
      const desc = r.description?.trim();
      if (desc && desc.length >= 55) knownBodies.push(cleanBodyForParser(desc));
    }
  }

  const canonical = loadChatDedupIndex(CANONICAL_CHAT);
  const seenFp = new Set<string>([...dbFps, ...canonical.fps]);
  const seenBodies = [...knownBodies, ...canonical.bodies];
  let created = 0;
  let skipped = 0;
  let skippedDup = 0;

  for (const msg of all) {
    const mergedFiles = [...new Set([...msg.files, ...(mergeMap.get(msg.index) ?? [])])];
    if (!hasResolvableMedia(mergedFiles, MARKET1)) continue;
    const one = parseWhatsAppListingText(msg.clean);
    if (!looksLikeListingFromClean(msg.clean, one)) continue;
    const fp = listingFingerprint(msg.clean, msg.senderPhone);
    if (seenFp.has(fp)) {
      skippedDup++;
      continue;
    }
    if (isDuplicateOfCanonical(msg.clean, msg.senderPhone, fp, seenFp, seenBodies)) {
      skippedDup++;
      continue;
    }
    if (mergedFiles.some((f) => usedAttachments.has(f))) {
      console.log(`\nSkip duplicate media: ${one.parsed.title.slice(0, 60)}`);
      skippedDup++;
      continue;
    }

    console.log(`\nImport: ${one.parsed.title.slice(0, 60)}`);
    const images: { url: string; public_id: string }[] = [];
    const videos: { url: string; public_id: string }[] = [];

    for (const fname of mergedFiles) {
      const ext = path.extname(fname).toLowerCase();
      const kind = MEDIA_EXT[ext];
      if (!kind) continue;
      const localPath = path.join(MARKET1, fname);
      if (!existsSync(localPath)) {
        console.warn(`  missing file: ${fname}`);
        continue;
      }
      if (kind === 'video' && statSync(localPath).size / (1024 * 1024) > 40) continue;
      if (dryRun) {
        console.log(`  would upload ${fname}`);
        if (kind === 'image') images.push({ url: 'dry', public_id: fname });
        else videos.push({ url: 'dry', public_id: fname });
        continue;
      }
      try {
        console.log(`  uploading ${fname}…`);
        const up = await uploadListingMediaToCloudinary(cloudinary, localPath, kind);
        if (kind === 'image') images.push(up);
        else videos.push(up);
      } catch (e) {
        console.error(`  upload failed ${fname}:`, e);
      }
    }

    if (images.length === 0 && videos.length === 0) {
      console.warn('  skip: no media uploaded');
      skipped++;
      continue;
    }

    if (!one.parsed.agentPhone && msg.senderPhone) one.parsed.agentPhone = msg.senderPhone;
    if (!one.parsed.agentName && msg.senderName) one.parsed.agentName = msg.senderName;

    const rentPeriod =
      one.parsed.listingType === 'rent' ? one.parsed.rentPeriod || 'year' : undefined;
    const tsTag = tsTagFromDate(msg.sentAt);
    const payload = {
      title: one.parsed.title.slice(0, 200),
      description: one.parsed.description.slice(0, 5000),
      listingType: one.parsed.listingType,
      propertyType: one.parsed.propertyType,
      price: one.parsed.price,
      location: one.parsed.location,
      bedrooms: one.parsed.bedrooms,
      bathrooms: one.parsed.bathrooms,
      toilets: one.parsed.toilets ?? 0,
      area: one.parsed.area,
      amenities: [],
      tags: [
        'whatsapp-import',
        'whatsapp-chat-import',
        'world-market1-batch',
        `wa-fp:${fp}`,
        ...mergedFiles.map((f) => `wa-att:${f}`),
        ...(tsTag ? [tsTag] : []),
      ],
      agentName: one.parsed.agentName,
      agentPhone: one.parsed.agentPhone,
      rentPeriod,
      status: 'active' as const,
      images,
      videos,
    };

    if (payload.price <= 0) {
      console.warn('  skip: no price');
      skipped++;
      continue;
    }

    const validated = listingSchema.safeParse(payload);
    if (!validated.success) {
      console.warn('  skip: validation', validated.error.issues[0]?.message);
      skipped++;
      continue;
    }

    if (dryRun) {
      seenFp.add(fp);
      seenBodies.push(msg.clean);
      for (const f of mergedFiles) usedAttachments.add(f);
      created++;
      continue;
    }

    const fpTag = `wa-fp:${fp}`;
    const existing = await Listing.findOne({ tags: fpTag }).select('_id').lean();
    if (existing) {
      skippedDup++;
      seenFp.add(fp);
      continue;
    }

    await Listing.create({
      ...validated.data,
      slug: await ensureUniqueListingSlug({
        title: validated.data.title,
        location: validated.data.location,
      }),
      createdBy: author!._id,
      createdByType: 'user',
      viewCount: 0,
    });
    seenFp.add(fp);
    seenBodies.push(msg.clean);
    for (const f of mergedFiles) usedAttachments.add(f);
    created++;
    console.log('  created');
  }

  if (!dryRun) await mongoose.disconnect();
  console.log(`\nDone. created=${created} skipped=${skipped} skippedDup=${skippedDup}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
