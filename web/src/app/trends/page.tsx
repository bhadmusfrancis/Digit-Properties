import type { Metadata } from 'next';
import { canonicalAlternates } from '@/lib/seo/canonical';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { TREND_STATUS } from '@/lib/constants';
import { TrendsPageClient } from './TrendsPageClient';

export const metadata: Metadata = {
  title: 'Trends & Insights',
  description: 'News, market trends, events, and expert insights on Nigerian real estate, property development, and documentation.',
  ...canonicalAlternates('/trends'),
};

export default async function TrendsPage() {
  let initialPosts: Array<{
    _id: string;
    slug: string;
    title: string;
    excerpt: string;
    category: string;
    imageUrl?: string;
    createdAt: string;
    publishedAt?: string;
  }> = [];
  let initialPagination = { page: 1, pages: 1 };

  if (process.env.MONGODB_URI?.trim()) {
    try {
      await dbConnect();
      const limit = 12;
      const [posts, total] = await Promise.all([
        Trend.find({ status: TREND_STATUS.PUBLISHED })
          .sort({ publishedAt: -1, createdAt: -1 })
          .limit(limit)
          .select('title slug excerpt category imageUrl author publishedAt createdAt')
          .lean(),
        Trend.countDocuments({ status: TREND_STATUS.PUBLISHED }),
      ]);
      initialPosts = posts.map((p) => ({
        _id: String(p._id),
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt ?? '',
        category: p.category,
        imageUrl: p.imageUrl,
        createdAt: p.createdAt.toISOString(),
        publishedAt: p.publishedAt?.toISOString(),
      }));
      initialPagination = { page: 1, pages: Math.max(1, Math.ceil(total / limit)) };
    } catch (e) {
      console.error('[TrendsPage]', e);
    }
  }

  return <TrendsPageClient initialPosts={initialPosts} initialPagination={initialPagination} />;
}
