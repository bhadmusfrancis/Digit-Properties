import { NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/site-metadata';
import {
  buildImageSitemapUrlEntries,
  fetchActiveListingsForSitemap,
} from '@/lib/seo/listing-sitemap-data';

export const revalidate = 3600;

export async function GET() {
  const base = siteOrigin();
  let urlEntries: string[] = [];

  if (process.env.MONGODB_URI?.trim()) {
    try {
      const listings = await fetchActiveListingsForSitemap();
      urlEntries = buildImageSitemapUrlEntries(listings, base);
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
