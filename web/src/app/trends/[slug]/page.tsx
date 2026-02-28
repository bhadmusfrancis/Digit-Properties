'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TrendImage } from '@/components/trends/TrendImage';

export default function TrendPostPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['trend', slug],
    queryFn: () => fetch(`/api/trends/${slug}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found')))),
    enabled: !!slug,
  });

  const { data: listData } = useQuery({
    queryKey: ['trends', 'sidebar'],
    queryFn: () => fetch('/api/trends?limit=5').then((r) => r.json()),
    enabled: !!post,
  });
  const otherPosts = (listData?.posts ?? []).filter((p: { slug: string }) => p.slug !== slug).slice(0, 4);

  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} | Digit Properties Trends`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && post.excerpt) meta.setAttribute('content', post.excerpt);
  }, [post]);

  if (!slug || isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-5 w-24 bg-slate-200 rounded" />
          <div className="h-10 bg-slate-200 rounded w-4/5" />
          <div className="aspect-video bg-slate-200 rounded-2xl" />
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-full" />
            <div className="h-4 bg-slate-200 rounded w-full" />
            <div className="h-4 bg-slate-200 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Post not found</h1>
        <Link href="/trends" className="mt-6 inline-block text-primary-600 font-medium hover:underline">← Back to Trends</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:max-w-[1400px]">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px] xl:gap-14">
          {/* Main article */}
          <article className="min-w-0">
            <Link href="/trends" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
              <span aria-hidden>←</span> Back to Trends
            </Link>
            <header className="mt-6">
              <span className="inline-block rounded-full bg-primary-100 px-3.5 py-1.5 text-sm font-semibold text-primary-800">
                {post.category}
              </span>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem] leading-tight">
                {post.title}
              </h1>
              {(post.publishedAt || post.author) && (
                <p className="mt-4 text-sm text-slate-500">
                  {post.author && <span>{post.author}</span>}
                  {post.author && post.publishedAt && ' · '}
                  {post.publishedAt && new Date(post.publishedAt).toLocaleDateString('en-NG', { dateStyle: 'long' })}
                </p>
              )}
            </header>

            <div className="relative mt-8 aspect-video overflow-hidden rounded-2xl bg-slate-100 shadow-lg ring-1 ring-slate-200/50">
              {post.imageUrl ? (
                <TrendImage
                  src={post.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw,  min(900px, 80vw)"
                  priority
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400">
                  <span className="text-5xl" aria-hidden>📰</span>
                  <span className="text-sm font-medium">No image — add one in Admin → Edit post</span>
                </div>
              )}
            </div>

            {post.excerpt && (
              <div className="mt-8 rounded-xl bg-slate-50/80 border border-slate-200/60 px-6 py-5">
                <p className="text-lg leading-relaxed text-slate-700 font-medium">
                  {post.excerpt}
                </p>
              </div>
            )}

            <div
              className="trend-prose mt-10 rounded-xl bg-white/80 px-6 py-8 shadow-sm ring-1 ring-slate-200/50 sm:px-8
                prose prose-slate prose-lg max-w-none
                prose-headings:font-bold prose-headings:tracking-tight
                prose-h2:mt-14 prose-h2:mb-5 prose-h2:text-2xl prose-h2:text-slate-900 prose-h2:border-b-2 prose-h2:border-primary-200 prose-h2:pb-2 prose-h2:first:mt-8
                prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-xl prose-h3:text-slate-800
                prose-p:leading-[1.9] prose-p:mb-6 prose-p:text-slate-700 prose-p:text-[1.0625rem]
                prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                prose-ul:my-6 prose-ul:pl-6 prose-li:my-2 prose-li:leading-relaxed prose-li:pl-1
                prose-strong:text-slate-900 prose-strong:font-semibold"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </article>

          {/* Sidebar */}
          <aside className="lg:pt-12">
            <div className="sticky top-8 space-y-8">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">More from Trends</h2>
                <ul className="mt-4 space-y-4">
                  {otherPosts.length === 0 ? (
                    <li>
                      <Link href="/trends" className="text-primary-600 hover:underline">View all trends →</Link>
                    </li>
                  ) : (
                    otherPosts.map((p: { _id: string; slug: string; title: string; imageUrl?: string; category: string }) => (
                      <li key={p._id}>
                        <Link href={`/trends/${p.slug}`} className="group flex gap-3">
                          {p.imageUrl ? (
                            <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 [&>img]:absolute [&>img]:inset-0 [&>img]:h-full [&>img]:w-full">
                              <TrendImage
                                src={p.imageUrl}
                                alt=""
                                fill
                                className="object-cover transition group-hover:scale-105"
                                sizes="96px"
                              />
                            </div>
                          ) : (
                            <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-2xl">
                              📰
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-medium text-primary-600">{p.category}</span>
                            <p className="mt-0.5 text-sm font-medium text-slate-900 line-clamp-2 group-hover:text-primary-700">
                              {p.title}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <Link
                href="/trends"
                className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-primary-50/50 hover:text-primary-800"
              >
                View all trends
              </Link>
            </div>
          </aside>
        </div>
      </div>

    </div>
  );
}
