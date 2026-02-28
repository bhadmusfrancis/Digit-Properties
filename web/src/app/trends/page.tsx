'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TREND_CATEGORIES } from '@/lib/constants';
import { Suspense } from 'react';
import { TrendImage } from '@/components/trends/TrendImage';

type TrendPost = { _id: string; slug: string; title: string; excerpt: string; category: string; imageUrl?: string; createdAt: string; publishedAt?: string };

function buildQuery(params: URLSearchParams) {
  const q = new URLSearchParams();
  params.forEach((v, k) => { if (v) q.set(k, v); });
  return q.toString();
}

function TrendsContent() {
  const searchParams = useSearchParams();
  const query = buildQuery(searchParams);
  const { data, isLoading } = useQuery({
    queryKey: ['trends', query],
    queryFn: () => fetch(`/api/trends?${query}`).then((r) => r.json()),
    staleTime: 60 * 1000,
  });
  const posts: TrendPost[] = data?.posts ?? [];
  const pagination = data?.pagination ?? { page: 1, pages: 1 };
  const category = searchParams.get('category') || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Hero */}
      <section className="border-b border-slate-200/80 bg-slate-900/5">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 xl:max-w-[1400px]">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Trends &amp; Insights
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            News, market trends, events, and expert insights on Nigerian real estate, property development, and documentation.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/trends"
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${!category ? 'bg-primary-600 text-white shadow-sm' : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'}`}
            >
              All
            </Link>
            {TREND_CATEGORIES.map((c) => (
              <Link
                key={c}
                href={category === c ? '/trends' : `/trends?category=${encodeURIComponent(c)}`}
                className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${category === c ? 'bg-primary-600 text-white shadow-sm' : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'}`}
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 xl:max-w-[1400px]">
        {isLoading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse">
                <div className="aspect-[16/10] bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-5 bg-slate-200 rounded w-full" />
                  <div className="h-4 bg-slate-200 rounded w-full" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
            <p className="text-slate-500">No trend posts in this category yet.</p>
            <Link href="/trends" className="mt-4 inline-block text-primary-600 font-medium hover:underline">View all</Link>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {posts.map((p) => (
              <Link
                key={p._id}
                href={`/trends/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-primary-200 hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  {p.imageUrl ? (
                    <TrendImage
                      src={p.imageUrl}
                      alt=""
                      fill
                      className="object-cover transition duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
                      <span className="text-5xl text-primary-300">📰</span>
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
                    {p.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-semibold text-slate-900 line-clamp-2 transition group-hover:text-primary-700">
                    {p.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-slate-600 line-clamp-3">{p.excerpt}</p>
                  {p.publishedAt && (
                    <p className="mt-3 text-xs text-slate-400">
                      {new Date(p.publishedAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {pagination.pages > 1 && (
          <nav className="mt-12 flex justify-center gap-2" aria-label="Pagination">
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/trends?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(p) }).toString()}`}
                className={`min-w-[2.5rem] rounded-lg px-3 py-2 text-center text-sm font-medium transition ${p === pagination.page ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {p}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

export default function TrendsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-12">Loading…</div>}>
      <TrendsContent />
    </Suspense>
  );
}
