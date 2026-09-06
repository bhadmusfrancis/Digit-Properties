'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TrendImage } from '@/components/trends/TrendImage';
import { SocialShareButtons } from '@/components/ui/SocialShareButtons';
import { FeaturedSlot } from '@/components/listings/FeaturedSlot';
import { ListPropertyCta } from '@/components/listings/ListPropertyCta';
import { getTrendAuthorBio } from '@/lib/trend-authors';
import { formatTrendArticleHtml, stripInlineImages } from '@/lib/trends/html';

export type TrendPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  imageUrl?: string;
  author?: string;
  publishedAt?: string;
  createdAt?: string;
  sourceUrls?: string[];
};

type TrendPostClientProps = {
  initialPost?: TrendPost | null;
  shareUrl?: string;
  shareTitle?: string;
  shareText?: string;
};

export function TrendPostClient({ initialPost, shareUrl, shareTitle, shareText }: TrendPostClientProps) {
  const params = useParams();
  const slug = (params?.slug as string) ?? '';
  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['trend', slug],
    queryFn: () => fetch(`/api/trends/${slug}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found')))),
    enabled: !!slug,
    initialData: initialPost ?? undefined,
  });

  const { data: listData } = useQuery({
    queryKey: ['trends', 'sidebar'],
    queryFn: () => fetch('/api/trends?limit=5').then((r) => r.json()),
    enabled: !!post,
  });
  const otherPosts = (listData?.posts ?? []).filter((p: { slug: string }) => p.slug !== slug).slice(0, 4);

  const bodyHtml = useMemo(() => {
    if (!post?.content) return '';
    const formatted = formatTrendArticleHtml(post.content);
    return post.imageUrl ? stripInlineImages(formatted) : formatted;
  }, [post?.content, post?.imageUrl]);

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
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-14">
          <article className="min-w-0 max-w-3xl">
            <Link href="/trends" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
              <span aria-hidden>←</span> Back to Trends
            </Link>
            <header className="mt-5">
              <span className="inline-block rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-800">
                {post.category}
              </span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl leading-[1.15]">
                {post.title}
              </h1>
              {(post.publishedAt || post.author) && (
                <p className="mt-3 text-sm text-slate-500">
                  {post.author && <span>{post.author}</span>}
                  {post.author && post.publishedAt && ' · '}
                  {post.publishedAt && new Date(post.publishedAt).toLocaleDateString('en-NG', { dateStyle: 'long' })}
                </p>
              )}
            </header>

            {post.imageUrl ? (
              <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/60">
                <TrendImage
                  src={post.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 768px"
                  priority
                />
              </div>
            ) : null}

            {post.excerpt && (
              <p className="mt-6 text-lg leading-relaxed text-slate-600 border-l-[3px] border-primary-400 pl-4">
                {post.excerpt}
              </p>
            )}

            <div className="mt-5 border-y border-slate-100 py-3">
              <SocialShareButtons
                url={shareUrl ?? (typeof window !== 'undefined' ? `${window.location.origin}/trends/${slug}` : `/trends/${slug}`)}
                title={shareTitle ?? post.title}
                text={shareText ?? post.excerpt}
                mediaUrl={post.imageUrl}
              />
            </div>

            <div
              className="trend-prose rich-html-content mt-8
                prose prose-slate max-w-none
                prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-slate-900
                prose-h2:mt-10 prose-h2:mb-3 prose-h2:text-[1.35rem] prose-h2:leading-snug prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-2
                prose-h3:mt-7 prose-h3:mb-2 prose-h3:text-lg
                prose-p:my-0 prose-p:mb-4 prose-p:leading-[1.75] prose-p:text-[1.05rem] prose-p:text-slate-700
                prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                prose-ul:my-4 prose-ul:pl-5 prose-li:my-1.5 prose-li:leading-relaxed prose-li:text-slate-700
                prose-strong:text-slate-900 prose-strong:font-semibold
                prose-em:text-slate-700
                prose-blockquote:my-6"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            {Array.isArray(post.sourceUrls) && post.sourceUrls.length > 0 && (
              <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sources</h2>
                <ul className="mt-2.5 space-y-1.5">
                  {post.sourceUrls.map((url: string) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-sm font-medium text-primary-600 hover:underline"
                      >
                        {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {post.author && (
              <footer className="mt-8 rounded-xl border border-slate-200 bg-white px-5 py-4">
                <p className="text-sm font-semibold text-slate-900">{post.author}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{getTrendAuthorBio(post.author)}</p>
              </footer>
            )}

            <div className="mt-8">
              <ListPropertyCta />
            </div>
          </article>

          <aside className="lg:pt-8">
            <div className="sticky top-8 space-y-10">
              <FeaturedSlot placement="trends" hideWhenEmpty className="mb-0" />
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">More from Trends</h2>
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
                            <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-md bg-slate-100 [&>img]:absolute [&>img]:inset-0 [&>img]:h-full [&>img]:w-full">
                              <TrendImage
                                src={p.imageUrl}
                                alt=""
                                fill
                                className="object-cover transition group-hover:scale-105"
                                sizes="80px"
                              />
                            </div>
                          ) : (
                            <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-md bg-primary-50 text-xl">
                              📰
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-medium text-primary-600">{p.category}</span>
                            <p className="mt-0.5 text-sm font-medium leading-snug text-slate-900 line-clamp-2 group-hover:text-primary-700">
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
                className="block rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-800"
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
