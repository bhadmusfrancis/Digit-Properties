/**
 * POST /api/listings/check-new-duplicate
 * Pre-submit check for the new/edit listing form (title, description, media reuse).
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import { findUserListingDuplicate } from '@/lib/listing-dedupe';

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title : '';
    const description = typeof body.description === 'string' ? body.description : '';
    const imageIds = Array.isArray(body.imagePublicIds)
      ? body.imagePublicIds.filter((x: unknown): x is string => typeof x === 'string')
      : [];
    const videoIds = Array.isArray(body.videoPublicIds)
      ? body.videoPublicIds.filter((x: unknown): x is string => typeof x === 'string')
      : [];
    const excludeListingId =
      typeof body.excludeListingId === 'string' && body.excludeListingId.trim()
        ? body.excludeListingId.trim()
        : undefined;

    await dbConnect();
    const dup = await findUserListingDuplicate(
      session.user.id,
      {
        title,
        description,
        mediaPublicIds: [...imageIds, ...videoIds],
      },
      excludeListingId
    );

    if (dup) {
      return NextResponse.json({ error: dup.message, code: dup.code }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[check-new-duplicate]', e);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}
