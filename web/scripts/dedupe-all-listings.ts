/**
 * Remove duplicate listings cluster-wise:
 * - Same WhatsApp fingerprint tag wa-fp:… (any listing).
 * - Same Cloudinary public_ids on images+videos (only listings tagged whatsapp-chat-import),
 *   so accidental collisions on manually created listings are unlikely.
 *
 * Winner per cluster: highest media score (videos×100 + images), then earliest createdAt.
 *
 *   npx tsx scripts/dedupe-all-listings.ts           # dry-run (report only)
 *   npx tsx scripts/dedupe-all-listings.ts --apply    # delete losers + related docs
 */
import { existsSync } from 'fs';
import path from 'path';

type Row = {
  _id: { toString(): string };
  tags?: string[];
  images?: { url?: string; public_id?: string }[];
  videos?: { url?: string; public_id?: string }[];
  createdAt?: Date;
};

function mediaScore(row: Row): number {
  const imgs = Array.isArray(row.images) ? row.images.filter((i) => i?.url || i?.public_id) : [];
  const vids = Array.isArray(row.videos) ? row.videos.filter((v) => v?.url || v?.public_id) : [];
  return vids.length * 100 + imgs.length;
}

function waFpFromTags(tags?: string[]): string | null {
  if (!Array.isArray(tags)) return null;
  for (const t of tags) {
    if (typeof t === 'string' && t.startsWith('wa-fp:')) return t;
  }
  return null;
}

/** Stable key from media public_ids; null if no public_ids (URLs-only listings skip media-key dedupe). */
function mediaPublicIdsKey(row: Row, requireChatImport: boolean): string | null {
  if (requireChatImport) {
    if (!Array.isArray(row.tags) || !row.tags.includes('whatsapp-chat-import')) return null;
  }
  const img = [...new Set((row.images ?? []).map((i) => i.public_id?.trim()).filter(Boolean) as string[])].sort();
  const vid = [...new Set((row.videos ?? []).map((v) => v.public_id?.trim()).filter(Boolean) as string[])].sort();
  if (img.length === 0 && vid.length === 0) return null;
  return `img:${img.join('|')}#vid:${vid.join('|')}`;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  return { apply: argv.includes('--apply') };
}

async function main() {
  const { apply } = parseArgs();

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

  const rows = (await Listing.find({})
    .select('_id tags images videos createdAt')
    .lean()
    .exec()) as Row[];

  const rowById = new Map<string, Row>();
  for (const row of rows) {
    rowById.set(String(row._id), row);
  }

  const fpBuckets = new Map<string, string[]>();
  const mediaBuckets = new Map<string, string[]>();

  for (const row of rows) {
    const id = String(row._id);
    const fp = waFpFromTags(row.tags);
    if (fp) {
      const list = fpBuckets.get(fp) ?? [];
      list.push(id);
      fpBuckets.set(fp, list);
    }
    const mk = mediaPublicIdsKey(row, true);
    if (mk) {
      const list = mediaBuckets.get(mk) ?? [];
      list.push(id);
      mediaBuckets.set(mk, list);
    }
  }

  const uf = new UnionFind();
  const touchBucket = (ids: string[]) => {
    if (ids.length < 2) return;
    const [first, ...rest] = ids;
    for (const x of rest) uf.union(first, x);
  };

  for (const ids of fpBuckets.values()) touchBucket(ids);
  for (const ids of mediaBuckets.values()) touchBucket(ids);

  const idsInPlay = new Set<string>();
  for (const ids of fpBuckets.values()) {
    if (ids.length > 1) for (const id of ids) idsInPlay.add(id);
  }
  for (const ids of mediaBuckets.values()) {
    if (ids.length > 1) for (const id of ids) idsInPlay.add(id);
  }

  const byRoot = new Map<string, string[]>();
  for (const id of idsInPlay) {
    const r = uf.find(id);
    const arr = byRoot.get(r) ?? [];
    arr.push(id);
    byRoot.set(r, arr);
  }

  const finalGroups: string[][] = [];
  for (const ids of byRoot.values()) {
    const uniq = [...new Set(ids)];
    if (uniq.length > 1) finalGroups.push(uniq);
  }

  const toDelete = new Set<string>();
  let clusters = 0;

  for (const group of finalGroups) {
    clusters++;
    let winner = group[0];
    let bestScore = mediaScore(rowById.get(winner)!);
    let bestCreated = new Date(rowById.get(winner)!.createdAt ?? 0).getTime();

    for (let i = 1; i < group.length; i++) {
      const gid = group[i];
      const row = rowById.get(gid)!;
      const sc = mediaScore(row);
      const cr = new Date(row.createdAt ?? 0).getTime();
      if (sc > bestScore || (sc === bestScore && cr < bestCreated)) {
        winner = gid;
        bestScore = sc;
        bestCreated = cr;
      }
    }

    for (const gid of group) {
      if (gid !== winner) toDelete.add(gid);
    }
  }

  console.log(
    JSON.stringify(
      {
        totalListings: rows.length,
        duplicateClusters: clusters,
        listingsToDelete: toDelete.size,
        apply,
      },
      null,
      2
    )
  );

  if (toDelete.size === 0) {
    await mongoose.disconnect();
    return;
  }

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to delete duplicates.');
    const sample = [...toDelete].slice(0, 15);
    console.log('Sample loser IDs:', sample);
    await mongoose.disconnect();
    return;
  }

  const loserOids = [...toDelete].map((id) => new mongoose.Types.ObjectId(id));
  await Promise.all([
    ListingLike.deleteMany({ listingId: { $in: loserOids } }),
    SavedListing.deleteMany({ listingId: { $in: loserOids } }),
    Review.deleteMany({ listingId: { $in: loserOids } }),
    Claim.deleteMany({ listingId: { $in: loserOids } }),
  ]);
  const res = await Listing.deleteMany({ _id: { $in: loserOids } });
  console.log(`Deleted ${res.deletedCount} duplicate listings.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
