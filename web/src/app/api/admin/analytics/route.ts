import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import PageView from '@/models/PageView';
import { USER_ROLES } from '@/lib/constants';
import { countryFlagEmoji } from '@/lib/request-geo';

const ALLOWED_DAYS = new Set([7, 30, 90]);

function parseDays(url: URL): number {
  const raw = Number(url.searchParams.get('days') ?? '30');
  return ALLOWED_DAYS.has(raw) ? raw : 30;
}

function startDateForDays(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

type CountRow = { _id: string; count: number };
type DayRow = { _id: string; count: number };
type CountryRow = { _id: string; countryName: string; count: number };

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const days = parseDays(url);
    const since = startDateForDays(days);

    await dbConnect();

    const match = { createdAt: { $gte: since } };

    const [totalViews, uniqueVisitors, viewsByDay, viewsByCountry, topPages, topReferrers] =
      await Promise.all([
        PageView.countDocuments(match),
        PageView.distinct('sessionId', match).then((ids) => ids.length),
        PageView.aggregate<DayRow>([
          { $match: match },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        PageView.aggregate<CountryRow>([
          { $match: match },
          {
            $group: {
              _id: '$country',
              countryName: { $first: '$countryName' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ]),
        PageView.aggregate<CountRow>([
          { $match: match },
          { $group: { _id: '$path', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 15 },
        ]),
        PageView.aggregate<CountRow>([
          { $match: { ...match, referrer: { $exists: true, $ne: null } } },
          { $group: { _id: '$referrer', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

    const dayMap = new Map(viewsByDay.map((row) => [row._id, row.count]));
    const dailyViews: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyViews.push({ date: key, count: dayMap.get(key) ?? 0 });
    }

    return NextResponse.json({
      days,
      since: since.toISOString(),
      summary: {
        totalViews,
        uniqueVisitors,
        countriesReached: viewsByCountry.length,
      },
      dailyViews,
      viewsByCountry: viewsByCountry.map((row) => ({
        countryCode: row._id,
        countryName: row.countryName,
        flag: countryFlagEmoji(row._id),
        count: row.count,
      })),
      topPages: topPages.map((row) => ({ path: row._id, count: row.count })),
      topReferrers: topReferrers.map((row) => ({ referrer: row._id, count: row.count })),
    });
  } catch (e) {
    console.error('admin analytics error', e);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
