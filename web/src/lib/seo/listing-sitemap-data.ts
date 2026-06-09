import type { MetadataRoute } from 'next';
import { dbConnect } from '@/lib/db';
import { LISTING_STATUS } from '@/lib/constants';
import { getListingPathSegment } from '@/lib/listing-path';
import { plainTextExcerpt } from '@/lib/utils';
import { isListingIndexable } from '@/lib/seo/listing-indexability';
import { collectListingPhotoUrls, toAbsoluteImageUrlForSeo } from '@/lib/seo/listing-images';
import {
  buildListingVideoSeoItems,
  collectListingGalleryVideos,
} from '@/lib/seo/listing-videos';
import Listing from '@/models/Listing';

export type ListingSitemapRow = {
  _id: unknown;
  slug?: string;
  title?: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  images?: { url?: string; public_id?: string }[];
  videos?: { url?: string; public_id?: string }[];
};

export function escapeSitemapXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Active listings used by main, image, and video sitemaps. */
export async function fetchActiveListingsForSitemap(): Promise<ListingSitemapRow[]> {
  await dbConnect();
  const rows = await Listing.find({ status: LISTING_STATUS.ACTIVE })
    .select('_id slug title description createdAt updatedAt images videos')
    .lean();
  return rows as ListingSitemapRow[];
}

export function buildImageSitemapUrlEntries(listings: ListingSitemapRow[], base: string): string[] {
  const urlEntries: string[] = [];

  for (const doc of listings) {
    const photos = collectListingPhotoUrls(doc.images, { max: 24 });
    if (!photos.length) continue;

    const segment = getListingPathSegment({ _id: String(doc._id), slug: doc.slug });
    const pageUrl = `${base}/listings/${segment}`;
    const title = escapeSitemapXml(String(doc.title ?? 'Property listing').slice(0, 200));

    const imageBlocks = photos
      .map((href) => toAbsoluteImageUrlForSeo(href))
      .filter(Boolean)
      .map(
        (loc) =>
          `    <image:image>\n      <image:loc>${escapeSitemapXml(loc)}</image:loc>\n      <image:title>${title}</image:title>\n      <image:caption>${title}</image:caption>\n    </image:image>`
      )
      .join('\n');

    urlEntries.push(`  <url>\n    <loc>${escapeSitemapXml(pageUrl)}</loc>\n${imageBlocks}\n  </url>`);
  }

  return urlEntries;
}

export function buildVideoSitemapUrlEntries(listings: ListingSitemapRow[], base: string): string[] {
  const urlEntries: string[] = [];

  for (const doc of listings) {
    const galleryVideos = collectListingGalleryVideos(doc.images, doc.videos);
    if (!galleryVideos.length) continue;
    if (
      !isListingIndexable({
        images: doc.images,
        videos: doc.videos,
        description: doc.description,
      })
    ) {
      continue;
    }

    const segment = getListingPathSegment({ _id: String(doc._id), slug: doc.slug });
    const pagePath = `/listings/${segment}`;
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

    for (const v of seoVideos) {
      const watchUrl = `${base}${v.watchPagePath}`;
      urlEntries.push(`  <url>
    <loc>${escapeSitemapXml(watchUrl)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeSitemapXml(v.thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${escapeSitemapXml(v.name)}</video:title>
      <video:description>${escapeSitemapXml(v.description)}</video:description>
      <video:content_loc>${escapeSitemapXml(v.contentUrl)}</video:content_loc>
      <video:publication_date>${escapeSitemapXml(v.uploadDate)}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:live>no</video:live>
    </video:video>
  </url>`);
    }
  }

  return urlEntries;
}

/** Listing detail + video watch pages for the main sitemap. */
export function buildListingDetailSitemapRoutes(
  listings: ListingSitemapRow[],
  base: string,
  now: Date
): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [];

  for (const row of listings) {
    if (
      !isListingIndexable({
        images: row.images,
        videos: row.videos,
        description: row.description,
      })
    ) {
      continue;
    }

    const updated = row.updatedAt ? new Date(row.updatedAt) : now;
    const segment = getListingPathSegment({ _id: String(row._id), slug: row.slug });
    const listingPath = `/listings/${segment}`;

    routes.push({
      url: `${base}${listingPath}`,
      lastModified: updated,
      changeFrequency: 'weekly',
      priority: 0.7,
    });

    const galleryVideos = collectListingGalleryVideos(row.images, row.videos);
    if (!galleryVideos.length) continue;

    const seoVideos = buildListingVideoSeoItems({
      title: String(row.title ?? 'Property listing'),
      description: plainTextExcerpt(String(row.description ?? ''), 2048, String(row.title ?? '')),
      pagePath: listingPath,
      uploadDate: updated.toISOString(),
      videos: galleryVideos,
    });

    for (const v of seoVideos) {
      routes.push({
        url: `${base}${v.watchPagePath}`,
        lastModified: updated,
        changeFrequency: 'weekly',
        priority: 0.65,
      });
    }
  }

  return routes;
}
