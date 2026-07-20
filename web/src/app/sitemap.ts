import type { MetadataRoute } from 'next';
import { dbConnect } from '@/lib/db';
import { siteOrigin } from '@/lib/site-metadata';
import { LISTING_STATUS, TREND_STATUS } from '@/lib/constants';
import Listing from '@/models/Listing';
import Trend from '@/models/Trend';
import {
  buildLocationLandingPath,
} from '@/lib/location-seo';
import { buildListingDetailSitemapRoutes } from '@/lib/seo/listing-sitemap-data';

export const revalidate = 3600;

async function buildLocationSitemapEntries(base: string, now: Date): Promise<MetadataRoute.Sitemap> {
  const rows = await Listing.aggregate<{ _id: { state: string; city?: string }; count: number }>([
    { $match: { status: LISTING_STATUS.ACTIVE, 'location.state': { $exists: true, $ne: '' } } },
    {
      $group: {
        _id: { state: '$location.state', city: '$location.city' },
        count: { $sum: 1 },
      },
    },
  ]);

  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const push = (path: string, priority: number) => {
    if (seen.has(path)) return;
    seen.add(path);
    entries.push({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority,
    });
  };

  for (const row of rows) {
    const state = row._id.state;
    if (!state) continue;
    push(buildLocationLandingPath(state), 0.85);
    push(buildLocationLandingPath(state, { listingType: 'sale' }), 0.82);
    push(buildLocationLandingPath(state, { listingType: 'rent' }), 0.82);
    const city = row._id.city?.trim();
    if (city) {
      push(buildLocationLandingPath(state, { city }), 0.8);
      push(buildLocationLandingPath(state, { city, listingType: 'sale' }), 0.78);
      push(buildLocationLandingPath(state, { city, listingType: 'rent' }), 0.78);
    }
  }

  const suburbRows = await Listing.aggregate<{ _id: { state: string; suburb?: string } }>([
    {
      $match: {
        status: LISTING_STATUS.ACTIVE,
        'location.state': { $exists: true, $ne: '' },
        'location.suburb': { $exists: true, $nin: [null, ''] },
      },
    },
    { $group: { _id: { state: '$location.state', suburb: '$location.suburb' } } },
  ]);

  for (const row of suburbRows) {
    const state = row._id.state;
    const suburb = row._id.suburb?.trim();
    if (!state || !suburb) continue;
    push(buildLocationLandingPath(state, { suburb }), 0.78);
    push(buildLocationLandingPath(state, { suburb, listingType: 'sale' }), 0.76);
    push(buildLocationLandingPath(state, { suburb, listingType: 'rent' }), 0.76);
  }

  // Only advertise location pages that actually have active listings. Seeding
  // empty markets here produces thin pages that Google flags as soft 404s.

  return entries;
}

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
    const [listings, trends, locationRoutes, authorIds] = await Promise.all([
      Listing.find({
        status: LISTING_STATUS.ACTIVE,
        slug: { $exists: true, $nin: [null, ''] },
      })
        .select('_id slug updatedAt images videos description')
        .lean(),
      Trend.find({ status: TREND_STATUS.PUBLISHED })
        .select('slug updatedAt publishedAt')
        .lean(),
      buildLocationSitemapEntries(base, now),
      Listing.distinct('createdBy', { status: LISTING_STATUS.ACTIVE }),
    ]);

    const listingRoutes = buildListingDetailSitemapRoutes(
      listings as Parameters<typeof buildListingDetailSitemapRoutes>[0],
      base,
      now
    );

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

    const authorRoutes: MetadataRoute.Sitemap = authorIds
      .filter((id) => id != null)
      .map((id) => ({
        url: `${base}/authors/${String(id)}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.55,
      }));

    return [...staticRoutes, ...locationRoutes, ...listingRoutes, ...trendRoutes, ...authorRoutes];
  } catch (e) {
    console.error('[sitemap]', e);
    return staticRoutes;
  }
}
