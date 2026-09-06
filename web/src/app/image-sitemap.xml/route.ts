import { NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/site-metadata';
import { dbConnect } from '@/lib/db';
import { TREND_STATUS } from '@/lib/constants';
import Trend from '@/models/Trend';
import {
  buildImageSitemapUrlEntries,
  escapeSitemapXml,
  fetchActiveListingsForSitemap,
} from '@/lib/seo/listing-sitemap-data';
import { toAbsoluteImageUrlForSeo } from '@/lib/seo/listing-images';

export const revalidate = 3600;

function buildTrendImageSitemapEntries(
  trends: { slug?: string; title?: string; imageUrl?: string; imageCredit?: string }[],
  base: string
): string[] {
  const entries: string[] = [];
  for (const trend of trends) {
    const slug = typeof trend.slug === 'string' ? trend.slug.trim() : '';
    const rawImage = typeof trend.imageUrl === 'string' ? trend.imageUrl.trim() : '';
    if (!slug || !rawImage) continue;
    const loc = toAbsoluteImageUrlForSeo(rawImage);
    if (!loc) continue;
    const pageUrl = `${base}/trends/${slug}`;
    const title = escapeSitemapXml(String(trend.title ?? 'Digit Properties Trends').slice(0, 200));
    const caption = escapeSitemapXml(
      String(trend.imageCredit || trend.title || 'Trends article image').slice(0, 200)
    );
    entries.push(
      `  <url>\n    <loc>${escapeSitemapXml(pageUrl)}</loc>\n    <image:image>\n      <image:loc>${escapeSitemapXml(loc)}</image:loc>\n      <image:title>${title}</image:title>\n      <image:caption>${caption}</image:caption>\n    </image:image>\n  </url>`
    );
  }
  return entries;
}

export async function GET() {
  const base = siteOrigin();
  let urlEntries: string[] = [];

  if (process.env.MONGODB_URI?.trim()) {
    try {
      const [listings, trends] = await Promise.all([
        fetchActiveListingsForSitemap(),
        (async () => {
          await dbConnect();
          return Trend.find({
            status: TREND_STATUS.PUBLISHED,
            imageUrl: { $exists: true, $nin: [null, ''] },
            slug: { $exists: true, $nin: [null, ''] },
          })
            .select('slug title imageUrl imageCredit')
            .lean();
        })(),
      ]);
      urlEntries = [
        ...buildImageSitemapUrlEntries(listings, base),
        ...buildTrendImageSitemapEntries(trends as { slug?: string; title?: string; imageUrl?: string; imageCredit?: string }[], base),
      ];
    } catch (e) {
      console.error('[image-sitemap]', e);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
