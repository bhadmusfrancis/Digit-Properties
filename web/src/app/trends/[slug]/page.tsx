import { notFound } from 'next/navigation';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { TREND_STATUS } from '@/lib/constants';
import { TrendPostClient } from '@/components/trends/TrendPostClient';
import { PropertyLocationLinks } from '@/components/listings/PropertyLocationLinks';
import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/structured-data';

const baseUrl = () => siteOrigin();

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    if (!slug?.trim()) return {};
    await dbConnect();
    const post = await Trend.findOne({ slug: slug.trim(), status: TREND_STATUS.PUBLISHED })
      .select('title excerpt publishedAt updatedAt')
      .lean();
    if (!post) return {};
    const url = `${baseUrl()}/trends/${slug}`;
    const title = post.title;
    const description = (post.excerpt ?? post.title)?.slice(0, 160);
    const publishedTime = post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined;
    const modifiedTime = post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined;
    return {
      title,
      description: description ?? title,
      alternates: { canonical: url },
      openGraph: {
        type: 'article',
        title,
        description: description ?? title,
        url,
        siteName: 'Digit Properties',
        locale: 'en_NG',
        publishedTime,
        modifiedTime,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: description ?? title,
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
  const description = (post.excerpt ?? post.title)?.slice(0, 160) ?? post.title;
  const publishedAt = post.publishedAt?.toISOString();
  const modifiedAt = post.updatedAt?.toISOString();

  return (
    <>
      <JsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Trends', path: '/trends' },
            { name: post.title, path: `/trends/${slug}` },
          ]),
          buildArticleJsonLd({
            title: post.title,
            description,
            slug,
            imageUrl: post.imageUrl,
            publishedAt,
            modifiedAt,
            authorName: post.author,
          }),
        ]}
      />
      <TrendPostClient
        initialPost={initialPost}
        shareUrl={shareUrl}
        shareTitle={post.title}
        shareText={post.excerpt ?? undefined}
      />
      <PropertyLocationLinks />
    </>
  );
}
