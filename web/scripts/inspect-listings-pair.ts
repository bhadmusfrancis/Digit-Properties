/**
 * One-off: compare two listing IDs, print winner vs loser for dedupe.
 *   npx tsx scripts/inspect-listings-pair.ts <id1> <id2>
 *   npx tsx scripts/inspect-listings-pair.ts --delete-loser <id1> <id2>
 */
import { existsSync } from 'fs';
import path from 'path';

function mediaScore(doc: {
  images?: { url?: string; public_id?: string }[];
  videos?: { url?: string; public_id?: string }[];
}) {
  const imgs = Array.isArray(doc.images) ? doc.images.filter((i) => i?.url || i?.public_id) : [];
  const vids = Array.isArray(doc.videos) ? doc.videos.filter((v) => v?.url || v?.public_id) : [];
  return vids.length * 100 + imgs.length;
}

async function main() {
  const argv = process.argv.slice(2);
  let deleteLoser = false;
  let ids = argv;
  if (argv[0] === '--delete-loser') {
    deleteLoser = true;
    ids = argv.slice(1);
  }
  if (ids.length !== 2) {
    console.error('Usage: npx tsx scripts/inspect-listings-pair.ts [--delete-loser] <id1> <id2>');
    process.exit(1);
  }

  const { config } = await import('dotenv');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const ListingLike = (await import('../src/models/ListingLike')).default;
  const SavedListing = (await import('../src/models/SavedListing')).default;
  const Review = (await import('../src/models/Review')).default;
  const Claim = (await import('../src/models/Claim')).default;

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const [a, b] = await Promise.all([Listing.findById(ids[0]).lean(), Listing.findById(ids[1]).lean()]);
  if (!a || !b) {
    console.error('One or both listings not found', { a: !!a, b: !!b });
    await mongoose.disconnect();
    process.exit(1);
  }

  const scoreA = mediaScore(a as Parameters<typeof mediaScore>[0]);
  const scoreB = mediaScore(b as Parameters<typeof mediaScore>[0]);
  const createdA = new Date((a as { createdAt?: Date }).createdAt ?? 0).getTime();
  const createdB = new Date((b as { createdAt?: Date }).createdAt ?? 0).getTime();

  let winnerId = ids[0];
  let loserId = ids[1];
  if (scoreB > scoreA) {
    winnerId = ids[1];
    loserId = ids[0];
  } else if (scoreB === scoreA && createdB < createdA) {
    winnerId = ids[1];
    loserId = ids[0];
  }

  console.log(JSON.stringify({ ids: [ids[0], ids[1]], scoreA, scoreB, createdA, createdB, winnerId, loserId }, null, 2));
  console.log('Tags A', (a as { tags?: string[] }).tags);
  console.log('Tags B', (b as { tags?: string[] }).tags);
  console.log('Title A', (a as { title?: string }).title?.slice(0, 80));
  console.log('Title B', (b as { title?: string }).title?.slice(0, 80));

  if (deleteLoser) {
    const oid = new mongoose.Types.ObjectId(loserId);
    await Promise.all([
      ListingLike.deleteMany({ listingId: oid }),
      SavedListing.deleteMany({ listingId: oid }),
      Review.deleteMany({ listingId: oid }),
      Claim.deleteMany({ listingId: oid }),
    ]);
    await Listing.findByIdAndDelete(loserId);
    console.log(`Deleted loser ${loserId}, kept ${winnerId}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
