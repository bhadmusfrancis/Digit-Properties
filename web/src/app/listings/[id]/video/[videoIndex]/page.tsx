import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { canViewListingOnSite, isListingPendingApprovalHidden } from '@/lib/listing-access';
import { JsonLd } from '@/components/seo/JsonLd';
import { ListingWatchVideo } from '@/components/listings/ListingWatchVideo';
import { ListingMediaDownloadButton } from '@/components/listings/ListingMediaDownloadButton';
import { ListingTemporarilyUnavailable } from '@/components/listings/ListingTemporarilyUnavailable';
import { dbConnect } from '@/lib/db';
import { getListingPublicPath } from '@/lib/listing-path';
import { resolveListingPublicSegment } from '@/lib/resolve-listing';
import { siteOrigin } from '@/lib/site-metadata';
import { buildBreadcrumbJsonLd, buildVideoObjectJsonLd } from '@/lib/seo/structured-data';
import {
  buildListingVideoSeoItems,
  collectListingGalleryVideos,
} from '@/lib/seo/listing-videos';
import { isListingIndexable } from '@/lib/seo/listing-indexability';
import { plainTextExcerpt, isNextNavigationError } from '@/lib/utils';
import { formatListingLocationDisplay } from '@/lib/listing-location';

function parseVideoIndex(raw: string): number | null {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n - 1;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; videoIndex: string }>;
}): Promise<Metadata> {
  try {
    const { id, videoIndex: videoIndexRaw } = await params;
    const videoIndex = parseVideoIndex(videoIndexRaw);
    if (videoIndex == null) return {};

    await dbConnect();
    const session = await getServerSession(authOptions);
    let resolved;
    try {
      resolved = await resolveListingPublicSegment(id);
    } catch {
      return {};
    }
    const { listing, publicSegment } = resolved;
    if (!listing || !publicSegment) return {};

    if (
      isListingPendingApprovalHidden({
        status: listing.status,
        createdBy: listing.createdBy,
        session,
      })
    ) {
      return {
        title: 'Temporarily unavailable',
        robots: { index: false, follow: true },
      };
    }
    if (
      !canViewListingOnSite({
        status: listing.status,
        createdBy: listing.createdBy,
        session,
      })
    ) {
      return {};
    }

    const galleryVideos = collectListingGalleryVideos(
      (listing as { images?: { url?: string; public_id?: string }[] }).images,
      (listing as { videos?: { url?: string; public_id?: string }[] }).videos
    );
    const video = galleryVideos[videoIndex];
    if (!video) return {};

    const listingPath = getListingPublicPath({ _id: String(listing._id), slug: publicSegment });
    const title = String(listing.title ?? 'Property listing');
    const description = plainTextExcerpt(String(listing.description ?? ''), 160, title);
    const seoItems = buildListingVideoSeoItems({
      title,
      description: plainTextExcerpt(String(listing.description ?? ''), 2048, title),
      pagePath: listingPath,
      uploadDate: listing.updatedAt
        ? new Date(listing.updatedAt as Date).toISOString()
        : listing.createdAt
          ? new Date(listing.createdAt as Date).toISOString()
          : undefined,
      videos: galleryVideos,
    });
    const seo = seoItems[videoIndex];
    if (!seo) return {};

    const canonical = `${siteOrigin()}${seo.watchPagePath}`;
    const isIndexable =
      id.trim() === publicSegment &&
      isListingIndexable({
        images: (listing as { images?: { url?: string }[] }).images,
        videos: (listing as { videos?: { url?: string; public_id?: string }[] }).videos,
        description: listing.description,
      });

    return {
      title: `${seo.name} | Digit Properties`,
      description,
      alternates: { canonical },
      robots: isIndexable ? { index: true, follow: true } : { index: false, follow: true },
      openGraph: {
        type: 'video.other',
        title: seo.name,
        description,
        url: canonical,
        siteName: 'Digit Properties',
        videos: [
          {
            url: seo.contentUrl,
            width: 1280,
            height: 720,
            type: 'video/mp4',
          },
        ],
        images: [{ url: seo.thumbnailUrl }],
      },
    };
  } catch (e) {
    if (isNextNavigationError(e)) throw e;
    console.error('[ListingVideoPage generateMetadata]', e);
    return {};
  }
}

export default async function ListingVideoWatchPage({
  params,
}: {
  params: Promise<{ id: string; videoIndex: string }>;
}) {
  const { id, videoIndex: videoIndexRaw } = await params;
  const videoIndex = parseVideoIndex(videoIndexRaw);
  if (videoIndex == null) notFound();

  await dbConnect();
  const session = await getServerSession(authOptions);

  let resolved;
  try {
    resolved = await resolveListingPublicSegment(id);
  } catch {
    notFound();
  }
  const { listing: listingPre, publicSegment, shouldRedirect, redirectTo } = resolved;
  if (!listingPre || !publicSegment) notFound();

  if (shouldRedirect && redirectTo) {
    permanentRedirect(`${redirectTo}/video/${videoIndex + 1}`);
  }

  const listingPath = getListingPublicPath({ _id: String(listingPre._id), slug: publicSegment });

  if (
    isListingPendingApprovalHidden({
      status: listingPre.status,
      createdBy: listingPre.createdBy,
      session,
    })
  ) {
    return (
      <ListingTemporarilyUnavailable
        title={listingPre.title}
        state={listingPre.location?.state}
        city={listingPre.location?.city}
      />
    );
  }

  if (
    !canViewListingOnSite({
      status: listingPre.status,
      createdBy: listingPre.createdBy,
      session,
    })
  ) {
    notFound();
  }

  const galleryVideos = collectListingGalleryVideos(
    (listingPre as { images?: { url?: string; public_id?: string }[] }).images,
    (listingPre as { videos?: { url?: string; public_id?: string }[] }).videos
  );
  const video = galleryVideos[videoIndex];
  if (!video) notFound();

  const title = String(listingPre.title ?? 'Property listing');
  const description = plainTextExcerpt(String(listingPre.description ?? ''), 2048, title);
  const locationLabel = formatListingLocationDisplay(listingPre.location);
  const uploadDate = listingPre.updatedAt
    ? new Date(listingPre.updatedAt as Date).toISOString()
    : listingPre.createdAt
      ? new Date(listingPre.createdAt as Date).toISOString()
      : new Date().toISOString();

  const seoItems = buildListingVideoSeoItems({
    title,
    description,
    pagePath: listingPath,
    uploadDate,
    videos: galleryVideos,
  });
  const seo = seoItems[videoIndex]!;

  return (
    <>
      <JsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Listings', path: '/listings' },
            { name: title, path: listingPath },
            { name: 'Video', path: seo.watchPagePath },
          ]),
          buildVideoObjectJsonLd({
            name: seo.name,
            description: seo.description,
            thumbnailUrl: seo.thumbnailUrl,
            contentUrl: seo.contentUrl,
            embedUrl: seo.watchPagePath,
            uploadDate: seo.uploadDate,
          }),
        ]}
      />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-4 text-sm text-gray-600">
          <Link href={listingPath} className="font-medium text-primary-700 hover:underline">
            ← Back to listing
          </Link>
        </nav>
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{seo.name}</h1>
          {locationLabel.trim() ? <p className="mt-1 text-gray-600">{locationLabel}</p> : null}
        </header>
        <ListingWatchVideo src={video.url} public_id={video.public_id} title={seo.name} />
        <div className="mt-4">
          <ListingMediaDownloadButton
            url={video.url}
            public_id={video.public_id}
            title={String(listing.title ?? seo.name)}
            videoIndex={videoIndex}
          />
        </div>
        {description ? (
          <p className="mt-6 text-sm leading-relaxed text-gray-700">{description.slice(0, 500)}</p>
        ) : null}
        <p className="mt-6">
          <Link
            href={listingPath}
            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            View full property listing
          </Link>
        </p>
      </div>
    </>
  );
}
