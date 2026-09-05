import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import { USER_ROLES } from '@/lib/constants';
import { generateDailyTrends } from '@/lib/trends/generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const result = await generateDailyTrends({ force });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[admin/trends/generate]', e);
    return NextResponse.json({ error: 'Failed to generate trend posts' }, { status: 500 });
  }
}
