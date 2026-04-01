import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { USER_ROLES } from '@/lib/constants';

type ListingLoc = {
  address?: string;
  city?: string;
  state?: string;
  suburb?: string;
};

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function locationLooksLikeVictoriaIsland(loc: ListingLoc | undefined): boolean {
  const text = normalizeSpace(
    [loc?.suburb, loc?.city, loc?.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  );
  if (!text) return false;
  return /\bvictoria\s+island\b|\bvi\b/i.test(text);
}

function preferredReplacement(loc: ListingLoc | undefined): string {
  const candidate =
    (loc?.suburb && normalizeSpace(loc.suburb)) ||
    (loc?.city && normalizeSpace(loc.city)) ||
    (loc?.state && normalizeSpace(loc.state)) ||
    'Lagos';
  return candidate;
}

function fixTitle(title: string, replacement: string): string {
  return normalizeSpace(
    title
      .replace(/\bvictoria\s+island\b/gi, replacement)
      .replace(/\b(at|in)\s+(at|in)\b/gi, '$1')
  );
}

/**
 * POST /api/admin/listings/fix-victoria-island-titles
 * Bulk-fix existing listing titles where "Victoria Island" appears in title
 * but the actual listing location is not Victoria Island.
 *
 * Optional body: { dryRun?: boolean } (default false)
 */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);

    await dbConnect();

    const candidates = await Listing.find({
      title: /\bvictoria\s+island\b/i,
    })
      .select('_id title location')
      .lean();

    const ops: Array<{
      updateOne: { filter: { _id: unknown }; update: { $set: { title: string } } };
    }> = [];
    const changedPreview: Array<{ id: string; from: string; to: string }> = [];

    for (const row of candidates as Array<{ _id: unknown; title?: string; location?: ListingLoc }>) {
      const oldTitle = typeof row.title === 'string' ? row.title : '';
      if (!oldTitle) continue;
      if (locationLooksLikeVictoriaIsland(row.location)) continue;

      const replacement = preferredReplacement(row.location);
      const newTitle = fixTitle(oldTitle, replacement);
      if (!newTitle || newTitle === oldTitle) continue;

      ops.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { title: newTitle } },
        },
      });
      if (changedPreview.length < 20) {
        changedPreview.push({ id: String(row._id), from: oldTitle, to: newTitle });
      }
    }

    let modifiedCount = 0;
    if (!dryRun && ops.length > 0) {
      const res = await Listing.bulkWrite(ops, { ordered: false });
      modifiedCount = res.modifiedCount ?? 0;
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      scanned: candidates.length,
      matchedForFix: ops.length,
      modifiedCount: dryRun ? 0 : modifiedCount,
      preview: changedPreview,
    });
  } catch (e) {
    console.error('[admin/fix-victoria-island-titles]', e);
    return NextResponse.json({ error: 'Failed to fix titles' }, { status: 500 });
  }
}

