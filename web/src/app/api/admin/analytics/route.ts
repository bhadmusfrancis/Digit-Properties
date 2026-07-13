import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import { USER_ROLES } from '@/lib/constants';
import { loadPublicTrafficReport, parseAnalyticsDays } from '@/lib/analytics-query';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const days = parseAnalyticsDays(url.searchParams.get('days'));

    await dbConnect();
    const report = await loadPublicTrafficReport(days);

    return NextResponse.json(report);
  } catch (e) {
    console.error('admin analytics error', e);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
