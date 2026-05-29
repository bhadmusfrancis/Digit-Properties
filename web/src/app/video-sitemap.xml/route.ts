import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { LISTING_STATUS } from '@/lib/constants';
import Listing from '@/models/Listing';
import { getListingPathSegment } from '@/lib/listing-path';
import { siteOrigin } from '@/lib/site-metadata';
import {
  buildListingVideoSeoItems,
  collectListingGalleryVideos,
} from '@/lib/seo/listing-videos';
import { plainTextExcerpt } from '@/lib/utils';

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
      const listings = await Listing.find({ status: LISTING_STATUS.ACTIVE })
        .select('_id slug title description createdAt updatedAt images videos')
        .lean();

      for (const row of listings) {
        const doc = row as {
          _id: unknown;
          slug?: string;
          title?: string;
          description?: string;
          createdAt?: Date;
          updatedAt?: Date;
          images?: { url?: string; public_id?: string }[];
          videos?: { url?: string; public_id?: string }[];
        };

        const galleryVideos = collectListingGalleryVideos(doc.images, doc.videos);
        if (!galleryVideos.length) continue;

        const segment = getListingPathSegment({ _id: String(doc._id), slug: doc.slug });
        const pagePath = `/listings/${segment}`;
        const pageUrl = `${base}${pagePath}`;
        const uploadDate = (doc.updatedAt ?? doc.createdAt ?? new Date()).toISOString();
        const description = plainTextExcerpt(
          String(doc.description ?? ''),
          2048,
          String(doc.title ?? 'Property listing')
        );

        const seoVideos = buildListingVideoSeoItems({
          title: String(doc.title ?? 'Property listing'),
          description,
          pagePath,
          uploadDate,
          videos: galleryVideos,
        });

        const videoTags = seoVideos
          .map(
            (v) => `    <video:video>
      <video:thumbnail_loc>${escapeXml(v.thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${escapeXml(v.name)}</video:title>
      <video:description>${escapeXml(v.description)}</video:description>
      <video:content_loc>${escapeXml(v.contentUrl)}</video:content_loc>
      <video:publication_date>${escapeXml(v.uploadDate)}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:live>no</video:live>
    </video:video>`
          )
          .join('\n');

        urlEntries.push(`  <url>
    <loc>${escapeXml(pageUrl)}</loc>
${videoTags}
  </url>`);
      }
    } catch (e) {
      console.error('[video-sitemap]', e);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urlEntries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
