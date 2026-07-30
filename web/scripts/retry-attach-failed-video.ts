/**
 * Attach a previously failed chat-import video to the existing listing (by wa-fp).
 *
 *   npx tsx scripts/retry-attach-failed-video.ts \
 *     --source-dir "../WhatsApp Chat - MISGRAM NIG LTD11" \
 *     --file "00000072-VIDEO-2026-07-25-08-05-14.mp4"
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';

import {
  MEDIA_EXT,
  cleanBodyForParser,
  extractAttachmentFilenames,
  listingFingerprint,
  parseMessageMeta,
  splitChatMessages,
  uploadListingMediaToCloudinary,
} from './lib/chat-import-utils';
import { resolveSourceDir } from './lib/chat-import-paths';
import { mongoUriForConnect } from './lib/mongo-uri';

function parseArgs() {
  const argv = process.argv.slice(2);
  let sourceDir = '';
  let file = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source-dir' && argv[i + 1]) sourceDir = argv[++i];
    else if (a === '--file' && argv[i + 1]) file = argv[++i];
  }
  if (!sourceDir || !file) {
    console.error('Usage: --source-dir "<folder>" --file "name.mp4"');
    process.exit(1);
  }
  return { sourceDir, file };
}

async function main() {
  const { config } = await import('dotenv');
  config({ path: path.resolve(process.cwd(), '.env.local') });

  const { sourceDir: sourceDirArg, file } = parseArgs();
  const sourceDir = resolveSourceDir(sourceDirArg);
  const sourceChat = path.join(sourceDir, 'chat.txt');
  const localPath = path.join(sourceDir, file);

  if (!existsSync(sourceChat)) {
    console.error(`Missing ${sourceChat}`);
    process.exit(1);
  }
  if (!existsSync(localPath)) {
    console.error(`Missing media file ${localPath}`);
    process.exit(1);
  }

  const ext = path.extname(file).toLowerCase();
  const kind = MEDIA_EXT[ext];
  if (!kind) {
    console.error(`Unsupported media extension: ${ext}`);
    process.exit(1);
  }

  const raw = readFileSync(sourceChat, 'utf8');
  const match = splitChatMessages(raw).find((full) =>
    extractAttachmentFilenames(full).includes(file)
  );
  if (!match) {
    console.error(`No chat message references ${file}`);
    process.exit(1);
  }

  const { body, senderPhone } = parseMessageMeta(match);
  const clean = cleanBodyForParser(body);
  const fp = listingFingerprint(clean, senderPhone);
  const fpTag = `wa-fp:${fp}`;
  console.log(`Fingerprint: ${fpTag}`);
  console.log(`Title hint: ${clean.slice(0, 80)}`);

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
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

  const listing = await Listing.findOne({ tags: fpTag }).lean();
  if (!listing) {
    console.error(`No listing found with tag ${fpTag}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found listing ${listing._id}: ${String(listing.title).slice(0, 70)}`);
  console.log(
    `Current media: ${(listing.images || []).length} image(s), ${(listing.videos || []).length} video(s)`
  );

  console.log(`Uploading ${file} (${kind})…`);
  const up = await uploadListingMediaToCloudinary(cloudinary, localPath, kind);

  const videos = [...(listing.videos || [])];
  const images = [...(listing.images || [])];
  if (kind === 'video') {
    if (videos.some((v) => v.public_id === up.public_id || v.url === up.url)) {
      console.log('Video already on listing; nothing to do.');
      await mongoose.disconnect();
      return;
    }
    videos.push(up);
  } else {
    if (images.some((v) => v.public_id === up.public_id || v.url === up.url)) {
      console.log('Image already on listing; nothing to do.');
      await mongoose.disconnect();
      return;
    }
    images.push(up);
  }

  const tags = (listing.tags || []).filter((t: string) => t !== 'wa-no-media');
  await Listing.updateOne(
    { _id: listing._id },
    { $set: { images, videos, tags } }
  );

  console.log(`Updated listing ${listing._id}: ${images.length} image(s), ${videos.length} video(s)`);
  console.log(`Video URL: ${up.url}`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
