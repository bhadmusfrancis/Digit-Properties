'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';

type AnalyticsResponse = {
  days: number;
  since: string;
  summary: {
    totalViews: number;
    uniqueVisitors: number;
    countriesReached: number;
    avgPagesPerVisitor: number;
    bounceRate: number;
    viewsChangePercent: number | null;
    visitorsChangePercent: number | null;
    directTrafficPercent: number;
    peakHourUtc: number;
    peakHourViews: number;
  };
  dailyViews: { date: string; views: number; visitors: number }[];
  hourlyDistribution: { hour: number; count: number }[];
  trafficSources: { source: string; label: string; count: number; percent: number }[];
  devices: { device: string; label: string; count: number; percent: number }[];
  viewsByCountry: {
    countryCode: string;
    countryName: string;
    flag: string;
    views: number;
    visitors: number;
    percent: number;
  }[];
  topPages: { path: string; title: string; views: number; visitors: number; percent: number }[];
  entryPages: { path: string; title: string; sessions: number; percent: number }[];
  topReferrers: { referrer: string; count: number }[];
};

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
] as const;

const SOURCE_COLORS: Record<string, string> = {
  direct: '#0ea5e9',
  search: '#10b981',
  social: '#8b5cf6',
  referral: '#f59e0b',
};

const DEVICE_COLORS: Record<string, string> = {
  mobile: '#0ea5e9',
  desktop: '#6366f1',
  tablet: '#14b8a6',
};

function formatNumber(n: number): string {
  return n.toLocaleString('en-NG');
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatHourUtc(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00 UTC`;
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-400">—</span>;
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  trend,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-30"
        style={{ background: accent }}
      />
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
        {trend !== undefined ? <TrendBadge value={trend} /> : null}
      </div>
      {sub ? <p className="mt-1.5 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DailyChart({
  data,
  days,
}: {
  data: AnalyticsResponse['dailyViews'];
  days: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxViews = Math.max(1, ...data.map((d) => d.views));
  const maxVisitors = Math.max(1, ...data.map((d) => d.visitors));

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />
          Page views
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Unique visitors
        </span>
      </div>
      <div className="flex h-52 items-end gap-0.5 sm:gap-1">
        {data.map((day, i) => {
          const viewHeight = Math.max(day.views > 0 ? 6 : 0, Math.round((day.views / maxViews) * 100));
          const visitorHeight = Math.max(
            day.visitors > 0 ? 4 : 0,
            Math.round((day.visitors / maxVisitors) * 72)
          );
          const showLabel =
            days <= 7 || i === 0 || i === data.length - 1 || day.date.endsWith('-01') || day.date.endsWith('-15');

          return (
            <div
              key={day.date}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i ? (
                <div className="absolute bottom-full z-10 mb-2 w-max max-w-[140px] rounded-lg border border-gray-200 bg-gray-900 px-2.5 py-2 text-center text-[11px] text-white shadow-lg">
                  <p className="font-medium">{formatShortDate(day.date)}</p>
                  <p className="mt-0.5 text-primary-200">{formatNumber(day.views)} views</p>
                  <p className="text-emerald-200">{formatNumber(day.visitors)} visitors</p>
                </div>
              ) : null}
              <div className="flex w-full items-end justify-center gap-px sm:gap-0.5">
                <div
                  className="w-[42%] max-w-[14px] rounded-t bg-primary-500/90 transition-all hover:bg-primary-600 sm:max-w-none sm:w-[45%]"
                  style={{ height: `${viewHeight}%` }}
                />
                <div
                  className="w-[42%] max-w-[14px] rounded-t bg-emerald-400/90 transition-all hover:bg-emerald-500 sm:max-w-none sm:w-[45%]"
                  style={{ height: `${visitorHeight}%` }}
                />
              </div>
              {showLabel ? (
                <span className="mt-2 hidden truncate text-[10px] text-gray-400 sm:block">
                  {formatShortDate(day.date)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourlyChart({ data }: { data: AnalyticsResponse['hourlyDistribution'] }) {
  const max = Math.max(1, ...data.map((h) => h.count));
  const peak = data.reduce((best, h) => (h.count > best.count ? h : best), data[0]);

  return (
    <div>
      <p className="mb-4 text-xs text-gray-500">
        Peak traffic at <span className="font-medium text-gray-700">{formatHourUtc(peak.hour)}</span> (
        {formatNumber(peak.count)} views)
      </p>
      <div className="flex gap-0.5 sm:gap-1">
        {data.map((hour) => {
          const intensity = hour.count / max;
          return (
            <div
              key={hour.hour}
              className="group relative flex min-w-0 flex-1 flex-col items-center"
              title={`${formatHourUtc(hour.hour)}: ${formatNumber(hour.count)} views`}
            >
              <div
                className="w-full rounded-md transition-colors"
                style={{
                  height: `${Math.max(hour.count > 0 ? 8 : 2, Math.round(intensity * 64))}px`,
                  background: `rgba(14, 165, 233, ${0.15 + intensity * 0.85})`,
                }}
              />
              {hour.hour % 6 === 0 ? (
                <span className="mt-1 hidden text-[9px] text-gray-400 sm:block">{hour.hour}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonutChart({
  segments,
}: {
  segments: { key: string; label: string; percent: number; color: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.percent, 0) || 1;
  let offset = 0;
  const gradient = segments
    .map((s) => {
      const start = offset;
      offset += (s.percent / total) * 100;
      return `${s.color} ${start}% ${offset}%`;
    })
    .join(', ');

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div
        className="relative h-36 w-36 shrink-0 rounded-full shadow-inner"
        style={{ background: total > 0 ? `conic-gradient(${gradient})` : '#e5e7eb' }}
      >
        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-2xl font-bold text-gray-900">{Math.round(total)}%</span>
          <span className="text-[10px] uppercase tracking-wide text-gray-400">split</span>
        </div>
      </div>
      <div className="w-full flex-1 space-y-2.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate text-gray-700">{s.label}</span>
            </span>
            <span className="shrink-0 tabular-nums font-medium text-gray-900">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CountryTable({ rows, totalViews }: { rows: AnalyticsResponse['viewsByCountry']; totalViews: number }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No geographic data yet for this period.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="pb-3 pr-4 font-medium">Country</th>
            <th className="pb-3 pr-4 font-medium">Views</th>
            <th className="pb-3 pr-4 font-medium">Visitors</th>
            <th className="pb-3 font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.countryCode} className="border-b border-gray-50 last:border-0">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg leading-none">{row.flag}</span>
                  <div>
                    <p className="font-medium text-gray-900">{row.countryName}</p>
                    {row.countryCode !== 'XX' ? (
                      <p className="text-xs text-gray-400">{row.countryCode}</p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="py-3 pr-4 tabular-nums text-gray-700">{formatNumber(row.views)}</td>
              <td className="py-3 pr-4 tabular-nums text-gray-700">{formatNumber(row.visitors)}</td>
              <td className="py-3">
                <div className="flex min-w-[120px] items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${totalViews > 0 ? (row.views / totalViews) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-500">
                    {row.percent}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PageList({
  rows,
  valueKey,
}: {
  rows: { path: string; title: string; views?: number; visitors?: number; sessions?: number; percent: number }[];
  valueKey: 'views' | 'sessions';
}) {
  const max = Math.max(1, ...rows.map((r) => (valueKey === 'views' ? r.views ?? 0 : r.sessions ?? 0)));

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const value = valueKey === 'views' ? row.views ?? 0 : row.sessions ?? 0;
        return (
          <div key={row.path} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{row.title}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-gray-400">{row.path}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-gray-900">{formatNumber(value)}</p>
                <p className="text-xs text-gray-400">{row.percent}%</p>
              </div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-200/80">
              <div
                className="h-full rounded-full bg-primary-500"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
            {valueKey === 'views' && row.visitors !== undefined ? (
              <p className="mt-2 text-xs text-gray-500">{formatNumber(row.visitors)} unique visitors</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-36 rounded-3xl bg-gradient-to-br from-gray-200 to-gray-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-gray-100" />
    </div>
  );
}

function AdminAnalyticsContent() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics?days=${days}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to load analytics');
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [days]);

  const sourceSegments = useMemo(
    () =>
      (data?.trafficSources ?? [])
        .filter((s) => s.percent > 0)
        .map((s) => ({
          key: s.source,
          label: s.label,
          percent: s.percent,
          color: SOURCE_COLORS[s.source] ?? '#94a3b8',
        })),
    [data]
  );

  const deviceSegments = useMemo(
    () =>
      (data?.devices ?? [])
        .filter((d) => d.percent > 0)
        .map((d) => ({
          key: d.device,
          label: d.label,
          percent: d.percent,
          color: DEVICE_COLORS[d.device] ?? '#94a3b8',
        })),
    [data]
  );

  return (
    <div className="space-y-6 pb-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary-800 to-indigo-900 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">Public traffic only</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Website analytics</h2>
            <p className="mt-2 text-sm leading-relaxed text-primary-100/90">
              Visitor behaviour across the public site — admin and dashboard activity are excluded from this report.
            </p>
          </div>
          <div className="inline-flex shrink-0 rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur-sm">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDays(opt.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  days === opt.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Page views"
              value={formatNumber(data.summary.totalViews)}
              sub={`vs previous ${data.days} days`}
              trend={data.summary.viewsChangePercent}
              accent="#0ea5e9"
            />
            <StatCard
              label="Unique visitors"
              value={formatNumber(data.summary.uniqueVisitors)}
              sub={`${data.summary.avgPagesPerVisitor} pages / visitor`}
              trend={data.summary.visitorsChangePercent}
              accent="#10b981"
            />
            <StatCard
              label="Countries"
              value={formatNumber(data.summary.countriesReached)}
              sub={`${data.summary.directTrafficPercent}% direct traffic`}
              accent="#8b5cf6"
            />
            <StatCard
              label="Bounce rate"
              value={`${data.summary.bounceRate}%`}
              sub={`Peak hour ${formatHourUtc(data.summary.peakHourUtc)}`}
              accent="#f59e0b"
            />
          </div>

          <SectionCard
            title="Traffic over time"
            description="Daily page views and unique visitors (UTC)"
          >
            <DailyChart data={data.dailyViews} days={data.days} />
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard
              title="Traffic sources"
              description="How visitors found the site"
              className="xl:col-span-1"
            >
              <DonutChart segments={sourceSegments} />
            </SectionCard>

            <SectionCard
              title="Devices"
              description="Based on browser user-agent"
              className="xl:col-span-1"
            >
              <DonutChart segments={deviceSegments} />
            </SectionCard>

            <SectionCard
              title="Hourly activity"
              description="When visitors browse (UTC)"
              className="xl:col-span-1"
            >
              <HourlyChart data={data.hourlyDistribution} />
            </SectionCard>
          </div>

          <SectionCard
            title="Visitors by country"
            description="Geographic distribution from edge headers at request time"
          >
            <CountryTable rows={data.viewsByCountry} totalViews={data.summary.totalViews} />
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Top pages" description="Most viewed public pages">
              <PageList rows={data.topPages} valueKey="views" />
            </SectionCard>
            <SectionCard title="Landing pages" description="First page visitors open in a session">
              <PageList
                rows={data.entryPages.map((p) => ({
                  ...p,
                  views: p.sessions,
                }))}
                valueKey="sessions"
              />
            </SectionCard>
          </div>

          {data.topReferrers.length > 0 ? (
            <SectionCard title="Top referrers" description="External websites sending traffic">
              <div className="grid gap-3 sm:grid-cols-2">
                {data.topReferrers.map((row) => {
                  let host = row.referrer;
                  try {
                    host = new URL(row.referrer).hostname.replace(/^www\./, '');
                  } catch {
                    // keep raw
                  }
                  const initial = host.charAt(0).toUpperCase();
                  return (
                    <div
                      key={row.referrer}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary-700 shadow-sm ring-1 ring-gray-200">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{host}</p>
                          <p className="truncate text-xs text-gray-400">{row.referrer}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-800">
                        {formatNumber(row.count)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function AdminAnalyticsClient() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AdminAnalyticsContent />
    </Suspense>
  );
}
