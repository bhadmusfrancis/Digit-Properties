'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';

type AnalyticsResponse = {
  days: number;
  since: string;
  summary: {
    totalViews: number;
    uniqueVisitors: number;
    countriesReached: number;
  };
  dailyViews: { date: string; count: number }[];
  viewsByCountry: {
    countryCode: string;
    countryName: string;
    flag: string;
    count: number;
  }[];
  topPages: { path: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
};

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
] as const;

function formatNumber(n: number): string {
  return n.toLocaleString('en-NG');
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function BarChart({
  items,
  maxValue,
  label,
  value,
}: {
  items: { key: string; label: string; sublabel?: string; count: number }[];
  maxValue: number;
  label: string;
  value: (item: { count: number }) => string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No data for this period.</p>;
  }

  return (
    <div className="space-y-3" role="list" aria-label={label}>
      {items.map((item) => {
        const width = maxValue > 0 ? Math.max(4, Math.round((item.count / maxValue) * 100)) : 0;
        return (
          <div key={item.key} role="listitem">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <div className="min-w-0 truncate font-medium text-gray-900" title={item.label}>
                {item.label}
                {item.sublabel ? (
                  <span className="ml-2 text-xs font-normal text-gray-500">{item.sublabel}</span>
                ) : null}
              </div>
              <span className="shrink-0 tabular-nums text-gray-700">{value(item)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
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

  const maxDaily = useMemo(
    () => Math.max(1, ...(data?.dailyViews.map((d) => d.count) ?? [1])),
    [data]
  );
  const maxCountry = useMemo(
    () => Math.max(1, ...(data?.viewsByCountry.map((c) => c.count) ?? [1])),
    [data]
  );
  const maxPage = useMemo(
    () => Math.max(1, ...(data?.topPages.map((p) => p.count) ?? [1])),
    [data]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Website traffic</h2>
          <p className="mt-1 text-sm text-gray-600">
            Page views and visitor geography across the public site.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDays(opt.value)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                days === opt.value
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total page views</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-primary-600">
                {formatNumber(data.summary.totalViews)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Unique visitors</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-600">
                {formatNumber(data.summary.uniqueVisitors)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Countries reached</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-indigo-600">
                {formatNumber(data.summary.countriesReached)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-base font-semibold text-gray-900">Daily page views</h3>
            <p className="mt-1 text-sm text-gray-500">UTC calendar days</p>
            <div className="mt-6 flex h-44 items-end gap-1 sm:gap-1.5">
              {data.dailyViews.map((day) => {
                const height = maxDaily > 0 ? Math.max(4, Math.round((day.count / maxDaily) * 100)) : 0;
                return (
                  <div
                    key={day.date}
                    className="group flex min-w-0 flex-1 flex-col items-center justify-end"
                    title={`${formatShortDate(day.date)}: ${formatNumber(day.count)} views`}
                  >
                    <div
                      className="w-full max-w-[20px] rounded-t-md bg-primary-500/90 transition-all group-hover:bg-primary-600 sm:max-w-none"
                      style={{ height: `${height}%` }}
                    />
                    {(data.days <= 7 || day.date.endsWith('-01') || day.date.endsWith('-15')) && (
                      <span className="mt-2 hidden text-[10px] text-gray-400 sm:block">
                        {formatShortDate(day.date)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-base font-semibold text-gray-900">Visitors by country</h3>
              <p className="mt-1 text-sm text-gray-500">Based on edge geo headers at request time</p>
              <div className="mt-5">
                <BarChart
                  label="Visitors by country"
                  maxValue={maxCountry}
                  items={data.viewsByCountry.map((c) => ({
                    key: c.countryCode,
                    label: `${c.flag} ${c.countryName}`,
                    sublabel: c.countryCode !== 'XX' ? c.countryCode : undefined,
                    count: c.count,
                  }))}
                  value={(item) => formatNumber(item.count)}
                />
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-base font-semibold text-gray-900">Top pages</h3>
              <p className="mt-1 text-sm text-gray-500">Most viewed paths</p>
              <div className="mt-5">
                <BarChart
                  label="Top pages"
                  maxValue={maxPage}
                  items={data.topPages.map((p) => ({
                    key: p.path,
                    label: p.path,
                    count: p.count,
                  }))}
                  value={(item) => formatNumber(item.count)}
                />
              </div>
            </section>
          </div>

          {data.topReferrers.length > 0 ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-base font-semibold text-gray-900">Top referrers</h3>
              <p className="mt-1 text-sm text-gray-500">External sites sending traffic</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 pr-4 font-medium">Source</th>
                      <th className="pb-2 text-right font-medium">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topReferrers.map((row) => (
                      <tr key={row.referrer} className="border-b border-gray-100 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{row.referrer}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-700">
                          {formatNumber(row.count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function AdminAnalyticsClient() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-gray-100" />}>
      <AdminAnalyticsContent />
    </Suspense>
  );
}
