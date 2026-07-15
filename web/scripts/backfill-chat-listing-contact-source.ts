/**
 * Set contactSource=listing on chat/bot imports that match the default rule
 * (no media OR price under ₦5M) and still have listing contact fields.
 *
 *   npx tsx scripts/backfill-chat-listing-contact-source.ts
 *   npx tsx scripts/backfill-chat-listing-contact-source.ts --apply
 */
import dns from 'node:dns';
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import {
  LISTING_CONTACT_LOW_PRICE_NGN,
  defaultChatImportContactSource,
  listingHasMedia,
} from '../src/lib/listing-contact-display';
import { isBotListingAuthor } from '../src/lib/claimable-listing';
import { mongoUriForConnect } from './lib/mongo-uri';

if (process.platform === 'win32') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  await import('../src/models/User');
  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const rows = await Listing.find({})
    .select('_id slug title price contactSource agentName agentPhone agentEmail createdByType tags images videos')
    .populate('createdBy', 'role')
    .lean();

  const toUpdate: string[] = [];
  for (const row of rows as any[]) {
    if (!isBotListingAuthor(row)) continue;
    if (row.contactSource === 'listing') continue;
    const hasListingContact = !!(
      String(row.agentName || '').trim() ||
      String(row.agentPhone || '').trim() ||
      String(row.agentEmail || '').trim()
    );
    const next = defaultChatImportContactSource({
      hasMedia: listingHasMedia(row),
      price: typeof row.price === 'number' ? row.price : 0,
      hasListingContact,
    });
    if (next === 'listing') toUpdate.push(String(row._id));
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        wouldSetListingContact: toUpdate.length,
        lowPriceThreshold: LISTING_CONTACT_LOW_PRICE_NGN,
        apply,
      },
      null,
      2
    )
  );

  if (!apply || toUpdate.length === 0) {
    if (!apply) console.log('Dry run only. Re-run with --apply to update.');
    await mongoose.disconnect();
    return;
  }

  const res = await Listing.updateMany(
    { _id: { $in: toUpdate.map((id) => new mongoose.Types.ObjectId(id)) } },
    { $set: { contactSource: 'listing' } }
  );
  console.log(`Updated ${res.modifiedCount} listings to contactSource=listing.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
