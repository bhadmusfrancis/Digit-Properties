import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { USER_ROLES } from '@/lib/constants';
import { backfillListingSlugs } from '@/lib/backfill-listing-slugs';

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await backfillListingSlugs();
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      samples: result.samples,
    });
  } catch (e) {
    console.error('[admin/listings/backfill-slugs]', e);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
