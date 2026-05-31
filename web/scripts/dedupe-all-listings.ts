/**
 * Remove duplicate listings cluster-wise:
 * - Same WhatsApp fingerprint tag wa-fp:… (any listing).
 * - Same wa-att:… attachment filename (whatsapp imports).
 * - Same Cloudinary public_ids on images+videos (only listings tagged whatsapp-chat-import),
 *   so accidental collisions on manually created listings are unlikely.
 * - Same canonical title + city/state (+ suburb) with similar description (reposted property).
 *
 * Winner per cluster: highest media score (videos×100 + images), then earliest createdAt.
 *
 *   npx tsx scripts/dedupe-all-listings.ts           # dry-run (report only)
 *   npx tsx scripts/dedupe-all-listings.ts --apply    # delete losers + related docs
 */
import dns from 'node:dns';
import { existsSync } from 'fs';
import path from 'path';
import { mongoUriForConnect } from './lib/mongo-uri';
import {
  listingTitleLocationDedupeKey,
  normalizeDescriptionForDedupe,
} from '../src/lib/listing-dedupe';
import { listingSlugDedupeBase } from '../src/lib/listing-slug';

/** Avoid querySrv ECONNREFUSED on some Windows DNS setups. */
if (process.platform === 'win32') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

type Row = {
  _id: { toString(): string };
  title?: string;
  slug?: string;
  description?: string;
  location?: { city?: string; state?: string; suburb?: string };
  tags?: string[];
  images?: { url?: string; public_id?: string }[];
  videos?: { url?: string; public_id?: string }[];
  createdAt?: Date;
};

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .split(/[^a-z0-9]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
  );
}

function tokenSimilarity(a: string, b: string): number {
  const as = tokenSet(a);
  const bs = tokenSet(b);
  if (as.size === 0 || bs.size === 0) return 0;
  let overlap = 0;
  for (const t of as) if (bs.has(t)) overlap += 1;
  const union = as.size + bs.size - overlap;
  return union > 0 ? overlap / union : 0;
}

/** Same property repost: matching title/location and overlapping listing text. */
function isTitleLocationDuplicate(a: Row, b: Row): boolean {
  const keyA = listingTitleLocationDedupeKey(a.title ?? '', a.location);
  const keyB = listingTitleLocationDedupeKey(b.title ?? '', b.location);
  if (!keyA || !keyB || keyA !== keyB) return false;
  if (slugIndicatesRepost(a, b)) return true;
  const descA = normalizeDescriptionForDedupe(a.description ?? '');
  const descB = normalizeDescriptionForDedupe(b.description ?? '');
  if (descA.length < 20 || descB.length < 20) return true;
  return tokenSimilarity(descA, descB) >= 0.5;
}

function slugIndicatesRepost(a: Row, b: Row): boolean {
  const sa = (a.slug ?? '').trim().toLowerCase();
  const sb = (b.slug ?? '').trim().toLowerCase();
  if (!sa || !sb || sa === sb) return false;
  return listingSlugDedupeBase(sa) === listingSlugDedupeBase(sb);
}

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

  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const rows = (await Listing.find({})
    .select('_id title slug description location tags images videos createdAt')
    .lean()
    .exec()) as Row[];

  const rowById = new Map<string, Row>();
  for (const row of rows) {
    rowById.set(String(row._id), row);
  }

  const fpBuckets = new Map<string, string[]>();
  const attBuckets = new Map<string, string[]>();
  const mediaBuckets = new Map<string, string[]>();
  const titleLocBuckets = new Map<string, string[]>();

  for (const row of rows) {
    const id = String(row._id);
    const fp = waFpFromTags(row.tags);
    if (fp) {
      const list = fpBuckets.get(fp) ?? [];
      list.push(id);
      fpBuckets.set(fp, list);
    }
    for (const t of row.tags ?? []) {
      if (typeof t === 'string' && t.startsWith('wa-att:')) {
        const list = attBuckets.get(t) ?? [];
        list.push(id);
        attBuckets.set(t, list);
      }
    }
    const mk = mediaPublicIdsKey(row, true);
    if (mk) {
      const list = mediaBuckets.get(mk) ?? [];
      list.push(id);
      mediaBuckets.set(mk, list);
    }
    const tl = listingTitleLocationDedupeKey(row.title ?? '', row.location);
    if (tl) {
      const list = titleLocBuckets.get(tl) ?? [];
      list.push(id);
      titleLocBuckets.set(tl, list);
    }
  }

  const uf = new UnionFind();
  const touchBucket = (ids: string[]) => {
    if (ids.length < 2) return;
    const [first, ...rest] = ids;
    for (const x of rest) uf.union(first, x);
  };

  const touchTitleLocationBucket = (ids: string[]) => {
    if (ids.length < 2) return;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = rowById.get(ids[i]);
        const b = rowById.get(ids[j]);
        if (a && b && isTitleLocationDuplicate(a, b)) uf.union(ids[i], ids[j]);
      }
    }
  };

  for (const ids of fpBuckets.values()) touchBucket(ids);
  for (const ids of attBuckets.values()) touchBucket(ids);
  for (const ids of mediaBuckets.values()) touchBucket(ids);
  for (const ids of titleLocBuckets.values()) touchTitleLocationBucket(ids);

  const idsInPlay = new Set<string>();
  const markMulti = (ids: string[]) => {
    if (ids.length > 1) for (const id of ids) idsInPlay.add(id);
  };
  for (const ids of fpBuckets.values()) markMulti(ids);
  for (const ids of attBuckets.values()) markMulti(ids);
  for (const ids of mediaBuckets.values()) markMulti(ids);
  for (const ids of titleLocBuckets.values()) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = rowById.get(ids[i]);
        const b = rowById.get(ids[j]);
        if (a && b && isTitleLocationDuplicate(a, b)) {
          idsInPlay.add(ids[i]);
          idsInPlay.add(ids[j]);
        }
      }
    }
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

  console.log('\nClusters to dedupe (winner kept):');
  for (const group of finalGroups.slice(0, 40)) {
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
    const w = rowById.get(winner)!;
    console.log(`\n  KEEP ${winner} "${(w.title ?? '').slice(0, 60)}"`);
    for (const gid of group) {
      if (gid === winner) continue;
      const row = rowById.get(gid)!;
      console.log(`  DEL  ${gid} "${(row.title ?? '').slice(0, 60)}"`);
    }
  }
  if (finalGroups.length > 40) console.log(`\n  … and ${finalGroups.length - 40} more clusters`);

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to delete duplicates.');
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
