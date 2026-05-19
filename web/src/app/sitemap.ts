import type { MetadataRoute } from 'next';
import { dbConnect } from '@/lib/db';
import { siteOrigin } from '@/lib/site-metadata';
import { LISTING_STATUS, TREND_STATUS } from '@/lib/constants';
import Listing from '@/models/Listing';
import Trend from '@/models/Trend';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/listings`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/trends`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  if (!process.env.MONGODB_URI?.trim()) {
    return staticRoutes;
  }

  try {
    await dbConnect();
    const [listings, trends] = await Promise.all([
      Listing.find({ status: LISTING_STATUS.ACTIVE })
        .select('_id updatedAt')
        .lean(),
      Trend.find({ status: TREND_STATUS.PUBLISHED })
        .select('slug updatedAt publishedAt')
        .lean(),
    ]);

    const listingRoutes: MetadataRoute.Sitemap = listings.map((row) => {
      const updated = row.updatedAt ? new Date(row.updatedAt as Date) : now;
      return {
        url: `${base}/listings/${String(row._id)}`,
        lastModified: updated,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      };
    });

    const trendRoutes: MetadataRoute.Sitemap = trends.map((row) => {
      const updated = row.updatedAt
        ? new Date(row.updatedAt as Date)
        : row.publishedAt
          ? new Date(row.publishedAt as Date)
          : now;
      return {
        url: `${base}/trends/${String(row.slug)}`,
        lastModified: updated,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      };
    });

    return [...staticRoutes, ...listingRoutes, ...trendRoutes];
  } catch (e) {
    console.error('[sitemap]', e);
    return staticRoutes;
  }
}
