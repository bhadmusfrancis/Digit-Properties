import type { Types } from 'mongoose';
import {
  buildPublicTrafficFilter,
  classifyTrafficSource,
  deviceFromUserAgent,
  humanizePath,
  percentChange,
  type DeviceType,
  type TrafficSource,
} from '@/lib/analytics-track';
import { countryFlagEmoji } from '@/lib/request-geo';
import User from '@/models/User';
import PageView from '@/models/PageView';
import { USER_ROLES } from '@/lib/constants';

export const ALLOWED_ANALYTICS_DAYS = [7, 30, 90] as const;
export type AnalyticsDays = (typeof ALLOWED_ANALYTICS_DAYS)[number];

export function parseAnalyticsDays(raw: string | null): AnalyticsDays {
  const n = Number(raw ?? '30');
  return (ALLOWED_ANALYTICS_DAYS as readonly number[]).includes(n) ? (n as AnalyticsDays) : 30;
}

export function startDateForDays(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

async function getAdminUserIds(): Promise<Types.ObjectId[]> {
  const admins = await User.find({ role: USER_ROLES.ADMIN }).select('_id').lean();
  return admins.map((u) => u._id as Types.ObjectId);
}

type CountRow = { _id: string; count: number };
type DayRow = { _id: string; views: number; visitors: string[] };
type CountryRow = { _id: string; countryName: string; views: number; visitors: string[] };
type HourRow = { _id: number; count: number };
type PageRow = { _id: string; views: number; visitors: string[] };
type EntryRow = { _id: string; count: number };
type SourceRow = { _id: string | null; count: number };
type DeviceRow = { _id: string; count: number };

function fillDailySeries(
  since: Date,
  days: number,
  rows: { _id: string; views: number; visitors: number }[]
): { date: string; views: number; visitors: number }[] {
  const map = new Map(rows.map((r) => [r._id, r]));
  const out: { date: string; views: number; visitors: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    out.push({ date: key, views: row?.views ?? 0, visitors: row?.visitors ?? 0 });
  }
  return out;
}

function sourceLabel(source: TrafficSource): string {
  switch (source) {
    case 'direct':
      return 'Direct';
    case 'search':
      return 'Search engines';
    case 'social':
      return 'Social media';
    case 'referral':
      return 'Referrals';
  }
}

function deviceLabel(device: DeviceType): string {
  switch (device) {
    case 'mobile':
      return 'Mobile';
    case 'tablet':
      return 'Tablet';
    case 'desktop':
      return 'Desktop';
  }
}

export async function loadPublicTrafficReport(days: AnalyticsDays) {
  const since = startDateForDays(days);
  const previousSince = new Date(since);
  previousSince.setUTCDate(previousSince.getUTCDate() - days);
  const adminUserIds = await getAdminUserIds();
  const match = buildPublicTrafficFilter(since, adminUserIds);
  const previousMatch = buildPublicTrafficFilter(previousSince, adminUserIds);
  previousMatch.createdAt = { $gte: previousSince, $lt: since };

  const [
    totalViews,
    uniqueVisitors,
    previousViews,
    previousVisitors,
    viewsByDay,
    viewsByCountry,
    hourlyDistribution,
    topPages,
    entryPages,
    referrersRaw,
    devicesRaw,
    sessionDepth,
  ] = await Promise.all([
    PageView.countDocuments(match),
    PageView.distinct('sessionId', match).then((ids) => ids.length),
    PageView.countDocuments(previousMatch),
    PageView.distinct('sessionId', previousMatch).then((ids) => ids.length),
    PageView.aggregate<DayRow>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          views: { $sum: 1 },
          visitors: { $addToSet: '$sessionId' },
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
          views: { $sum: 1 },
          visitors: { $addToSet: '$sessionId' },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 25 },
    ]),
    PageView.aggregate<HourRow>([
      { $match: match },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    PageView.aggregate<PageRow>([
      { $match: match },
      {
        $group: {
          _id: '$path',
          views: { $sum: 1 },
          visitors: { $addToSet: '$sessionId' },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 20 },
    ]),
    PageView.aggregate<EntryRow>([
      { $match: match },
      { $sort: { createdAt: 1 } },
      { $group: { _id: '$sessionId', entryPath: { $first: '$path' } } },
      { $group: { _id: '$entryPath', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    PageView.find(match).select('referrer userAgent').lean(),
    PageView.aggregate<DeviceRow>([
      { $match: { ...match, userAgent: { $exists: true, $ne: null } } },
      { $group: { _id: '$userAgent', count: { $sum: 1 } } },
    ]),
    PageView.aggregate<{ _id: string; pages: number }>([
      { $match: match },
      { $group: { _id: '$sessionId', pages: { $sum: 1 } } },
    ]),
  ]);

  const dailyViews = fillDailySeries(
    since,
    days,
    viewsByDay.map((row) => ({
      _id: row._id,
      views: row.views,
      visitors: row.visitors.length,
    }))
  );

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const row = hourlyDistribution.find((h) => h._id === hour);
    return { hour, count: row?.count ?? 0 };
  });
  const peakHour = hours.reduce((best, h) => (h.count > best.count ? h : best), hours[0]);

  const sourceCounts: Record<TrafficSource, number> = {
    direct: 0,
    search: 0,
    social: 0,
    referral: 0,
  };
  for (const row of referrersRaw) {
    sourceCounts[classifyTrafficSource(row.referrer)] += 1;
  }
  const trafficSources = (Object.keys(sourceCounts) as TrafficSource[])
    .map((source) => ({
      source,
      label: sourceLabel(source),
      count: sourceCounts[source],
      percent: totalViews > 0 ? Math.round((sourceCounts[source] / totalViews) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const deviceCounts: Record<DeviceType, number> = { mobile: 0, tablet: 0, desktop: 0 };
  for (const row of devicesRaw) {
    deviceCounts[deviceFromUserAgent(row._id)] += row.count;
  }
  const deviceTotal = Object.values(deviceCounts).reduce((a, b) => a + b, 0);
  const devices = (Object.keys(deviceCounts) as DeviceType[]).map((device) => ({
    device,
    label: deviceLabel(device),
    count: deviceCounts[device],
    percent: deviceTotal > 0 ? Math.round((deviceCounts[device] / deviceTotal) * 1000) / 10 : 0,
  }));

  const referrerMap = new Map<string, number>();
  for (const row of referrersRaw) {
    const ref = row.referrer?.trim();
    if (!ref) continue;
    referrerMap.set(ref, (referrerMap.get(ref) ?? 0) + 1);
  }
  const topReferrers = [...referrerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([referrer, count]) => ({ referrer, count }));

  const avgPagesPerVisitor =
    uniqueVisitors > 0 ? Math.round((totalViews / uniqueVisitors) * 10) / 10 : 0;
  const singlePageSessions = sessionDepth.filter((s) => s.pages === 1).length;
  const bounceRate =
    uniqueVisitors > 0 ? Math.round((singlePageSessions / uniqueVisitors) * 1000) / 10 : 0;

  return {
    days,
    since: since.toISOString(),
    summary: {
      totalViews,
      uniqueVisitors,
      countriesReached: viewsByCountry.length,
      avgPagesPerVisitor,
      bounceRate,
      viewsChangePercent: percentChange(totalViews, previousViews),
      visitorsChangePercent: percentChange(uniqueVisitors, previousVisitors),
      directTrafficPercent: trafficSources.find((s) => s.source === 'direct')?.percent ?? 0,
      peakHourUtc: peakHour.hour,
      peakHourViews: peakHour.count,
    },
    dailyViews,
    hourlyDistribution: hours,
    trafficSources,
    devices,
    viewsByCountry: viewsByCountry.map((row) => ({
      countryCode: row._id,
      countryName: row.countryName,
      flag: countryFlagEmoji(row._id),
      views: row.views,
      visitors: row.visitors.length,
      percent: totalViews > 0 ? Math.round((row.views / totalViews) * 1000) / 10 : 0,
    })),
    topPages: topPages.map((row) => ({
      path: row._id,
      title: humanizePath(row._id),
      views: row.views,
      visitors: row.visitors.length,
      percent: totalViews > 0 ? Math.round((row.views / totalViews) * 1000) / 10 : 0,
    })),
    entryPages: entryPages.map((row) => ({
      path: row._id,
      title: humanizePath(row._id),
      sessions: row.count,
      percent: uniqueVisitors > 0 ? Math.round((row.count / uniqueVisitors) * 1000) / 10 : 0,
    })),
    topReferrers,
  };
}

export async function loadPublicTrafficSummary(since: Date) {
  const adminUserIds = await getAdminUserIds();
  const match = buildPublicTrafficFilter(since, adminUserIds);
  const [totalViews, uniqueVisitors] = await Promise.all([
    PageView.countDocuments(match),
    PageView.distinct('sessionId', match).then((ids) => ids.length),
  ]);
  return { totalViews, uniqueVisitors };
}
