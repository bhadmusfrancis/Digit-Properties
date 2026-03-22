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

import { readFileSync, existsSync } from 'fs';
import path from 'path';

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
} {
  const m = full.match(
    /^\[[^\]]+\]\s+~\s+([^~]+)\s+~\s+\(([^)]*)\):\s*([\s\S]*)$/
  );
  if (!m) {
    return { body: full.trim(), senderName: '', senderPhone: undefined };
  }
  const senderName = m[1].trim();
  const phoneRaw = m[2].trim();
  let senderPhone: string | undefined;
  if (phoneRaw && phoneRaw !== 'unknown') {
    let p = phoneRaw.replace(/\s/g, '');
    if (p.startsWith('0')) p = '+234' + p.slice(1);
    else if (!p.startsWith('+') && /^\d/.test(p)) p = '+' + p;
    senderPhone = p;
  }
  return { body: m[3].trim(), senderName, senderPhone };
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
    const stream = cloudinary.uploader.upload_stream(opts, (err, res) => {
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

  let created = 0;
  let skipped = 0;
  let uploadErrors = 0;

  for (let mi = 0; mi < messages.length; mi++) {
    const full = messages[mi];
    const { body, senderName, senderPhone } = parseMessageMeta(full);
    const files = extractAttachmentFilenames(body);
    const clean = cleanBodyForParser(body);
    if (clean.length < 15) {
      skipped++;
      continue;
    }

    const one = parseWhatsAppListingText(clean);
    if (!one.parsed.agentPhone && senderPhone) one.parsed.agentPhone = senderPhone;
    const looksLikeListing =
      one.parsed.price > 0 ||
      one.parsed.bedrooms > 0 ||
      (one.parsed.area ?? 0) > 0 ||
      (clean.length >= 40 &&
        /\b(rent|sale|bed|bath|₦|m\b|k\b|sqm|bn\b|jv\b|joint\s+venture)/i.test(clean));
    if (!looksLikeListing) {
      skipped++;
      continue;
    }
    const results = [one];

    const images: { url: string; public_id: string }[] = [];
    const videos: { url: string; public_id: string }[] = [];

    for (const fname of files) {
      const ext = path.extname(fname).toLowerCase();
      const kind = MEDIA_EXT[ext];
      if (!kind) continue;

      const localPath = path.join(mediaDir, fname);
      if (!existsSync(localPath)) {
        console.warn(`  missing file (msg ${mi + 1}): ${fname}`);
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

    for (let ri = 0; ri < results.length; ri++) {
      const { parsed, confidence, missing } = results[ri];
      if (!parsed.agentName && senderName) parsed.agentName = senderName;
      if (!parsed.agentPhone && senderPhone) parsed.agentPhone = senderPhone;

      let description = parsed.description;
      if (description.length < 20) {
        description = `${description}\n\n(Imported from WhatsApp chat.)`.slice(0, 5000);
      }
      if (description.length > 5000) description = description.slice(0, 5000);

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
        tags: [...(parsed.tags || []), 'whatsapp-chat-import'],
        agentName: parsed.agentName,
        agentPhone: parsed.agentPhone,
        agentEmail: parsed.agentEmail,
        rentPeriod: parsed.rentPeriod,
        status: 'active' as const,
        images,
        videos,
      };

      if (payload.price <= 0) {
        console.warn(`  skip (no price): msg ${mi + 1} "${payload.title.slice(0, 50)}..."`);
        skipped++;
        continue;
      }

      const validated = listingSchema.safeParse(payload);
      if (!validated.success) {
        console.warn(
          `  skip (validation): msg ${mi + 1} #${ri + 1}`,
          validated.error.flatten().fieldErrors
        );
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(
          `[dry-run] would create: "${validated.data.title.slice(0, 60)}..." | ${confidence} | missing: ${missing.join(', ') || '—'} | media: ${images.length} img, ${videos.length} vid`
        );
        created++;
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
  }

  if (!dryRun) {
    await mongoose.disconnect();
  }

  console.log('\nDone.');
  console.log(`Created: ${created}, skipped rows: ${skipped}, upload errors: ${uploadErrors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
