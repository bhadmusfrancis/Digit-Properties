import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { LISTING_STATUS } from '@/lib/constants';
import Listing from '@/models/Listing';
import { getListingPathSegment } from '@/lib/listing-path';
import { siteOrigin } from '@/lib/site-metadata';
import { collectListingPhotoUrls, toAbsoluteImageUrlForSeo } from '@/lib/seo/listing-images';

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const base = siteOrigin();
  const urlEntries: string[] = [];

  if (process.env.MONGODB_URI?.trim()) {
    try {
      await dbConnect();
      const listings = await Listing.find({
        status: LISTING_STATUS.ACTIVE,
        'images.0.url': { $exists: true, $ne: '' },
      })
        .select('_id slug title images')
        .lean();

      for (const row of listings) {
        const doc = row as {
          _id: unknown;
          slug?: string;
          title?: string;
          images?: { url?: string }[];
        };

        const photos = collectListingPhotoUrls(doc.images, { max: 24 });
        if (!photos.length) continue;

        const segment = getListingPathSegment({ _id: String(doc._id), slug: doc.slug });
        const pageUrl = `${base}/listings/${segment}`;
        const title = escapeXml(String(doc.title ?? 'Property listing').slice(0, 200));

        const imageBlocks = photos
          .map((href) => toAbsoluteImageUrlForSeo(href))
          .filter(Boolean)
          .map(
            (loc) =>
              `    <image:image>\n      <image:loc>${escapeXml(loc)}</image:loc>\n      <image:title>${title}</image:title>\n      <image:caption>${title}</image:caption>\n    </image:image>`
          )
          .join('\n');

        urlEntries.push(`  <url>\n    <loc>${escapeXml(pageUrl)}</loc>\n${imageBlocks}\n  </url>`);
      }
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
