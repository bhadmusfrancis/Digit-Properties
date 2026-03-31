/**
 * Bulk-import WhatsApp chat export into listings (same parsing as "Import from WhatsApp").
 *
 * - Splits chat.txt into messages (lines starting with [m/d/yy, time]).
 * - Extracts <attached: filename> for images (jpg/png/webp) and videos (mp4/webm/mov) from the media folder.
 * - One chat message = one listing (full message parsed with parseWhatsAppListingText only).
 * - Uploads media to Cloudinary (listings folder), assigns createdBy to the author user by email.
 *
 * Run from web/ (requires MONGODB_URI + Cloudinary env in .env.local):
 *   npx tsx scripts/import-chat-listings.ts
 *   npx tsx scripts/import-chat-listings.ts --dry-run
 *   npx tsx scripts/import-chat-listings.ts --chat "../WhatsApp Chat - WORLD MARKET/chat.txt"
 *   npx tsx scripts/import-chat-listings.ts --email "fabhainternation@gmail.com"
 */

import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const AUTHOR_EMAIL_DEFAULT = 'fabhainternation@gmail.com';

const ATTACHED_RE = /<attached:\s*([^>]+)>/gi;
const MSG_HEADER_RE = /^\[\d{1,2}\/\d{1,2}\/\d{2,4},/;

const MEDIA_EXT: Record<string, 'image' | 'video'> = {
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.webp': 'image',
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
};

function parseArgs() {
  const argv = process.argv.slice(2);
  let chatPath = path.resolve(
    process.cwd(),
    '..',
    'WhatsApp Chat - WORLD MARKET',
    'chat.txt'
  );
  let mediaDir: string | null = null;
  let email = AUTHOR_EMAIL_DEFAULT;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--chat' && argv[i + 1]) chatPath = path.resolve(argv[++i]);
    else if (a === '--media-dir' && argv[i + 1]) mediaDir = path.resolve(argv[++i]);
    else if (a === '--email' && argv[i + 1]) email = argv[++i];
  }
  if (!mediaDir) mediaDir = path.dirname(chatPath);
  return { chatPath, mediaDir, email, dryRun };
}

function splitChatMessages(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const messages: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (MSG_HEADER_RE.test(line)) {
      if (buf.length > 0) messages.push(buf.join('\n'));
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) messages.push(buf.join('\n'));
  return messages;
}

function parseMessageMeta(full: string): {
  body: string;
  senderName: string;
  senderPhone: string | undefined;
  sentAt: Date | null;
} {
  const m = full.match(
    /^\[([^\]]+)\]\s+~\s+([^~]+)\s+~\s+\(([^)]*)\):\s*([\s\S]*)$/
  );
  if (!m) {
    return { body: full.trim(), senderName: '', senderPhone: undefined, sentAt: null };
  }
  const dtRaw = m[1].trim();
  const senderName = m[2].trim();
  const phoneRaw = m[3].trim();
  let senderPhone: string | undefined;
  if (phoneRaw && phoneRaw !== 'unknown') {
    let p = phoneRaw.replace(/\s/g, '');
    if (p.startsWith('0')) p = '+234' + p.slice(1);
    else if (!p.startsWith('+') && /^\d/.test(p)) p = '+' + p;
    senderPhone = p;
  }
  const sentAt = parseWhatsappDate(dtRaw);
  return { body: m[4].trim(), senderName, senderPhone, sentAt };
}

function parseWhatsappDate(dtRaw: string): Date | null {
  const s = dtRaw.replace(/\u202f|\u00a0/g, ' ').trim();
  const re = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i;
  const m = s.match(re);
  if (m) {
    const yy = Number(m[3]);
    const year = yy < 100 ? 2000 + yy : yy;
    let hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = Number(m[6] ?? '0');
    const ampm = String(m[7]).toUpperCase();
    if (ampm === 'PM' && hh < 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;
    return new Date(year, Number(m[1]) - 1, Number(m[2]), hh, mm, ss);
  } 
  return null;
}

function extractAttachmentFilenames(body: string): string[] {
  const names: string[] = [];
  let exec: RegExpExecArray | null;
  const re = new RegExp(ATTACHED_RE.source, 'gi');
  while ((exec = re.exec(body)) !== null) {
    names.push(exec[1].trim());
  }
  return [...new Set(names)];
}

function cleanBodyForParser(body: string): string {
  return body
    .replace(/<attached:\s*[^>]+>/gi, '')
    .replace(/\u200e/g, '')
    .replace(/\bimage omitted\b/gi, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

function listingFingerprint(cleanBody: string, senderPhone?: string) {
  const normalized = cleanBody
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const payload = `${senderPhone ?? 'unknown'}|${normalized}`;
  return createHash('sha1').update(payload).digest('hex');
}

type ParsedChatMessage = {
  index: number;
  body: string;
  clean: string;
  senderName: string;
  senderPhone?: string;
  files: string[];
  sentAt: Date | null;
};

function looksLikeListingFromClean(clean: string, parsed: { parsed: { price: number; bedrooms: number; area?: number } }) {
  return (
    parsed.parsed.price > 0 ||
    parsed.parsed.bedrooms > 0 ||
    (parsed.parsed.area ?? 0) > 0 ||
    (clean.length >= 40 &&
      /\b(rent|sale|bed|bath|₦|m\b|k\b|sqm|bn\b|jv\b|joint\s+venture)/i.test(clean))
  );
}

function tsTagFromDate(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const tag = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `wa-ts:${tag}`;
}

function parseTsTag(tag: string): Date | null {
  const m = tag.match(/^wa-ts:(\d{14})$/);
  if (!m) return null;
  const s = m[1];
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  const h = Number(s.slice(8, 10));
  const mi = Number(s.slice(10, 12));
  const se = Number(s.slice(12, 14));
  return new Date(y, mo - 1, d, h, mi, se);
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

async function main() {
  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const User = (await import('../src/models/User')).default;
  const { listingSchema } = await import('../src/lib/validations');
  const { parseWhatsAppListingText } = await import('../src/lib/whatsapp-listing-parser');
  const cloudinary = (await import('cloudinary')).v2;
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const { chatPath, mediaDir, email: authorEmail, dryRun } = parseArgs();

  if (!existsSync(chatPath)) {
    console.error(`chat file not found: ${chatPath}`);
    process.exit(1);
  }
  if (!process.env.MONGODB_URI && !dryRun) {
    console.error('MONGODB_URI missing (set in .env.local)');
    process.exit(1);
  }
  if (
    !dryRun &&
    (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET)
  ) {
    console.error('Cloudinary env vars missing in .env.local');
    process.exit(1);
  }

  const raw = readFileSync(chatPath, 'utf8');
  const messages = splitChatMessages(raw);
  console.log(`Messages: ${messages.length} (from ${chatPath})`);
  console.log(`Media dir: ${mediaDir}`);
  console.log(`Author email: ${authorEmail}`);
  console.log(dryRun ? 'DRY RUN — no DB or uploads\n' : '');

  if (!dryRun) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }

  const author = dryRun
    ? null
    : await User.findOne({ email: authorEmail.toLowerCase().trim() }).lean();
  if (!dryRun && !author) {
    console.error(`User not found: ${authorEmail}. Create the account first.`);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }

  const uploadCache = new Map<string, { url: string; public_id: string; kind: 'image' | 'video' }>();
  let lastImportedSourceAt: Date | null = null;
  if (!dryRun) {
    const recent = await Listing.find({
      createdBy: author!._id,
      tags: 'whatsapp-chat-import',
    })
      .select('tags')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    for (const row of recent) {
      const tags = Array.isArray((row as { tags?: string[] }).tags) ? (row as { tags: string[] }).tags : [];
      for (const t of tags) {
        const d = parseTsTag(t);
        if (!d) continue;
        if (!lastImportedSourceAt || d > lastImportedSourceAt) lastImportedSourceAt = d;
      }
    }
  }
  if (lastImportedSourceAt) {
    console.log(`Incremental cutoff (last imported source message): ${lastImportedSourceAt.toISOString()}`);
  } else {
    console.log('Incremental cutoff: none (no prior wa-ts tags found)');
  }

  let created = 0;
  let skipped = 0;
  let updated = 0;
  let duplicates = 0;
  let uploadErrors = 0;
  const parsedMessages: ParsedChatMessage[] = messages.map((full, index) => {
    const { body, senderName, senderPhone, sentAt } = parseMessageMeta(full);
    return {
      index,
      body,
      clean: cleanBodyForParser(body),
      senderName,
      senderPhone,
      files: extractAttachmentFilenames(body),
      sentAt,
    };
  });

  const mediaMergeMap = new Map<number, string[]>();
  for (let i = 0; i < parsedMessages.length; i++) {
    const m = parsedMessages[i];
    if (!m.files.length) continue;
    const probe = m.clean.length > 0 ? parseWhatsAppListingText(m.clean) : null;
    const looksLike = probe ? looksLikeListingFromClean(m.clean, probe) : false;
    if (looksLike) continue;
    const candidates = [i - 1, i + 1];
    for (const c of candidates) {
      const near = parsedMessages[c];
      if (!near) continue;
      if ((near.senderPhone ?? '') !== (m.senderPhone ?? '')) continue;
      const nearProbe = near.clean.length > 0 ? parseWhatsAppListingText(near.clean) : null;
      const nearLooksLike = nearProbe ? looksLikeListingFromClean(near.clean, nearProbe) : false;
      if (!nearLooksLike) continue;
      const prev = mediaMergeMap.get(c) ?? [];
      mediaMergeMap.set(c, [...new Set([...prev, ...m.files])]);
      break;
    }
  }

  for (let mi = 0; mi < parsedMessages.length; mi++) {
    const msg = parsedMessages[mi];
    const clean = msg.clean;
    if (clean.length < 15) {
      skipped++;
      continue;
    }
    if (lastImportedSourceAt && msg.sentAt && msg.sentAt < lastImportedSourceAt) {
      skipped++;
      continue;
    }

    const one = parseWhatsAppListingText(clean);
    if (!one.parsed.agentPhone && msg.senderPhone) one.parsed.agentPhone = msg.senderPhone;
    const looksLikeListing = looksLikeListingFromClean(clean, one);
    if (!looksLikeListing) {
      skipped++;
      continue;
    }

    const mergedFiles = [...new Set([...(msg.files ?? []), ...(mediaMergeMap.get(mi) ?? [])])];
    const images: { url: string; public_id: string }[] = [];
    const videos: { url: string; public_id: string }[] = [];

    for (const fname of mergedFiles) {
      const ext = path.extname(fname).toLowerCase();
      const kind = MEDIA_EXT[ext];
      if (!kind) continue;
      const localPath = path.join(mediaDir, fname);
      if (!existsSync(localPath)) {
        console.warn(`  missing file (msg ${mi + 1}): ${fname}`);
        continue;
      }
      const fileSizeMb = statSync(localPath).size / (1024 * 1024);
      if (kind === 'video' && fileSizeMb > 40) {
        console.warn(`  skip large video >40MB (msg ${mi + 1}): ${fname}`);
        continue;
      }
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

    const { parsed, confidence, missing } = one;
    if (!parsed.agentName && msg.senderName) parsed.agentName = msg.senderName;
    if (!parsed.agentPhone && msg.senderPhone) parsed.agentPhone = msg.senderPhone;
    let description = parsed.description;
    if (description.length < 20) description = `${description}\n\n(Imported from WhatsApp chat.)`.slice(0, 5000);
    if (description.length > 5000) description = description.slice(0, 5000);

    const fp = listingFingerprint(clean, msg.senderPhone);
    const fpTag = `wa-fp:${fp}`;
    const tsTag = tsTagFromDate(msg.sentAt);
    const tags = [...new Set([...(parsed.tags || []), 'whatsapp-chat-import', fpTag, ...(tsTag ? [tsTag] : [])])];
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
        `[dry-run] would create/update: "${validated.data.title.slice(0, 60)}..." | ${confidence} | missing: ${missing.join(', ') || '—'} | media: ${images.length} img, ${videos.length} vid`
      );
      created++;
      continue;
    }

    const existing = await Listing.findOne({
      createdBy: author!._id,
      tags: fpTag,
    })
      .select('_id images videos')
      .lean();

    if (existing) {
      const oldImages = Array.isArray((existing as { images?: unknown[] }).images) ? (existing as { images: { url?: string; public_id?: string }[] }).images : [];
      const oldVideos = Array.isArray((existing as { videos?: unknown[] }).videos) ? (existing as { videos: { url?: string; public_id?: string }[] }).videos : [];
      const oldHasMedia = oldImages.length > 0 || oldVideos.length > 0;
      const newHasMedia = validated.data.images.length > 0 || (validated.data.videos?.length ?? 0) > 0;
      if (newHasMedia && !oldHasMedia) {
        await Listing.findByIdAndUpdate((existing as { _id: unknown })._id, {
          $set: {
            images: validated.data.images ?? [],
            videos: validated.data.videos?.length ? validated.data.videos : [],
            amenities: validated.data.amenities ?? [],
            tags: validated.data.tags ?? [],
            title: validated.data.title,
            description: validated.data.description,
            price: validated.data.price,
            listingType: validated.data.listingType,
            propertyType: validated.data.propertyType,
            location: validated.data.location,
            bedrooms: validated.data.bedrooms,
            bathrooms: validated.data.bathrooms,
            toilets: validated.data.toilets ?? 0,
            area: validated.data.area,
            agentName: validated.data.agentName,
            agentPhone: validated.data.agentPhone,
            agentEmail: validated.data.agentEmail,
            rentPeriod: validated.data.rentPeriod,
          },
        });
        updated++;
        console.log(`  updated duplicate with media: "${validated.data.title.slice(0, 55)}..."`);
      } else {
        duplicates++;
      }
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
    console.log(
      `  ok: "${validated.data.title.slice(0, 55)}..." (${confidence}, ${missing.length ? `missing ${missing.length}` : 'complete'})`
    );
  }

  if (!dryRun) {
    await mongoose.disconnect();
  }

  console.log('\nDone.');
  console.log(`Created: ${created}, updated: ${updated}, duplicates skipped: ${duplicates}, skipped rows: ${skipped}, upload errors: ${uploadErrors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
