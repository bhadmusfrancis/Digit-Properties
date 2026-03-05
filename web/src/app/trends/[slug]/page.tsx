import { notFound } from 'next/navigation';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { TREND_STATUS } from '@/lib/constants';
import { TrendPostClient } from '@/components/trends/TrendPostClient';
import type { Metadata } from 'next';

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';

function toAbsoluteImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const base = baseUrl();
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    if (!slug?.trim()) return {};
    await dbConnect();
    const post = await Trend.findOne({ slug: slug.trim(), status: TREND_STATUS.PUBLISHED })
      .select('title excerpt imageUrl')
      .lean();
    if (!post) return {};
    const url = `${baseUrl()}/trends/${slug}`;
    const title = post.title;
    const description = (post.excerpt ?? post.title)?.slice(0, 160);
    const ogImageUrl = toAbsoluteImageUrl(post.imageUrl);
    return {
      title: `${title} | Digit Properties Trends`,
      description: description ?? title,
      openGraph: {
        type: 'article',
        title,
        description: description ?? title,
        url,
        siteName: 'Digit Properties',
        locale: 'en_NG',
        ...(ogImageUrl && {
          images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: description ?? title,
        ...(ogImageUrl && { images: [ogImageUrl] }),
      },
    };
  } catch (e) {
    console.error('[TrendPostPage generateMetadata]', e);
    return {};
  }
}

export default async function TrendPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug?.trim()) notFound();
  await dbConnect();
  const post = await Trend.findOne({ slug: slug.trim(), status: TREND_STATUS.PUBLISHED }).lean();
  if (!post) notFound();

  const initialPost = {
    _id: String(post._id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    content: post.content ?? '',
    category: post.category,
    imageUrl: post.imageUrl,
    author: post.author,
    publishedAt: post.publishedAt?.toISOString(),
    createdAt: post.createdAt?.toISOString(),
  };

  const shareUrl = `${baseUrl()}/trends/${slug}`;
  return <TrendPostClient initialPost={initialPost} shareUrl={shareUrl} shareTitle={post.title} shareText={post.excerpt ?? undefined} />;
}
